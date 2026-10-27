'use client';
/* ─────────────────────────────────────────────────────────────────────────
   THE STORE. One place the app's state lives on the phone.

   award() is THE single scoring entry point. Everything that adds points —
   the score pad, Coach view, attendance, the check-in sheet, the recorder's
   tap-to-score, an approved small-group answer — goes through it. That is
   what makes three things true for free:
     · the audit log is complete,
     · approval routing is decided in one place (AUTO_APPROVE_ROLES), and
     · the offline outbox catches every write, including the automatic feeds.

   Offline, award() diverts to the outbox instead of the ledger. Every
   caller's confirmation must then say "held", not "posted" — a coach told
   the points landed, who then sees the board sit still, re-taps, which is
   exactly the duplicate the outbox exists to prevent. Callers use
   sayPosted(onlineMsg, offlineMsg) for toasts and postedLabel() for labels.
   ───────────────────────────────────────────────────────────────────────── */
import { createStore } from 'zustand/vanilla';
import { immer } from 'zustand/middleware/immer';
import type { Backend, DocKey, SyncEvent } from '@/lib/data/backend';
import {
  classifyRestored, heldEmpty, heldSince, heldTotal, mergeHeld, mergeOutbox, promoteFlag, replayOrder, wasHeld,
  withoutSent, type DoneFlag, type HeldPayload
} from '@/lib/held';
import { readHeld, removeHeld, writeHeld, writeHeldSync } from '@/lib/store/held-store';
import { autoApproves, canApprove, canEditRoster, canScore } from '@/lib/permissions';
import { attendanceRows } from '@/lib/feeds';
import { selfCheckin } from '@/lib/cycle';
import { fmt, pointBase, signed, standings } from '@/lib/scoring';
import type { ScoreEntryStatus } from '@/lib/types/domain';
import type {
  ActivityLine, EntryDetail, HeldOp, LedgerEntry, Membership, MinistryData, CheckinVia
} from '@/lib/types/model';

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

export interface AwardInput {
  team: string;
  cat: string;
  amount: number;
  why?: string;
  student?: string | null;
  detail?: EntryDetail | null;
  batch?: string | null;
  reverses?: string | null;
  /** Shown as who entered it. Defaults to the signed-in person. */
  by?: string;
  /** A captain's "submit with proof": allowed to queue though they cannot score. */
  submission?: boolean;
}

export interface PushBanner {
  id: number;
  title: string;
  body: string;
  href?: string;
}

export interface AppState {
  ready: boolean;
  backend: Backend;
  membership: Membership;
  data: MinistryData;
  outbox: HeldOp[];
  outboxSyncing: boolean;
  outboxError: string;
  staleHeld: HeldPayload | null;
  netOnline: boolean;
  /** Documents edited here whose save hasn't gone through yet. */
  unsavedDocs: DocKey[];
  /** The ministry's settings were changed here and haven't saved yet. */
  unsavedConfig: boolean;
  /** When each document last saved from here. */
  docSavedAt: Partial<Record<DocKey, number>>;
  offlineSim: boolean;
  /** When this phone last had confirmed signal — the "as of last signal" pill. */
  lastOnlineAt: number;
  toast: { msg: string; key: number } | null;
  push: PushBanner | null;
  roleSheetOpen: boolean;
  /** Coach view and check-in share ONE squad selection, so switching in one
   *  place switches the other. A coach never re-picks a team. */
  coachTeam: string;
  boardOpen: string | null;

  /* lifecycle */
  hydrate(data: MinistryData): void;
  setMembership(m: Membership): void;
  setNetOnline(on: boolean): void;
  restoreHeld(): Promise<void>;
  persistHeld(writeOnly?: boolean): void;

  /* feedback */
  offline(): boolean;
  say(msg: string): void;
  sayPosted(onlineMsg: string, offlineMsg: string): void;
  doneFlag(): 'posted' | 'held';
  firePush(title: string, body: string, href?: string): void;
  /** An audit line. `serverWrites`: the database function behind this
   *  action logs it itself, so on Supabase it's only shown here, not sent. */
  logActivity(line: string, serverWrites?: boolean): void;
  emit(e: SyncEvent): void;
  /** Save again any document whose save couldn't go (offline or failed). */
  saveUnsavedDocs(): void;
  mutate(recipe: (d: MinistryData) => void): void;

  /* scoring */
  base(): number;
  award(input: AwardInput): DoneFlag;
  awardMany(rows: AwardInput[]): DoneFlag;
  decide(ids: string[], status: ScoreEntryStatus): DoneFlag;
  undoLast(): void;
  flushOutbox(quiet?: boolean): void;
  /** Chat messages and RSVPs held offline: not points, so not the outbox —
   *  resent as-is when signal returns, and marked sent when they land. */
  resendSoftHeld(): void;
  toggleOfflineSim(): void;
  sendStaleHeld(): void;
  discardStaleHeld(): void;
  plantStaleHeld(): void;

  /* tonight */
  setCoachTeam(id: string): void;
  togglePresence(name: string): void;
  setPresence(name: string, on: boolean, via?: CheckinVia): void;
  /** A student checking themselves in from the door QR. */
  selfCheckIn(): boolean;
  markAllPresent(team: string, on: boolean): void;
  postAttendance(team: string): DoneFlag;

  /* ui */
  setRoleSheet(open: boolean): void;
  setBoardOpen(id: string | null): void;
}

const blankMembership: Membership = {
  mode: 'demo', persona: 'leader', role: 'leader', displayName: 'Pastor Mike', firstName: 'Pastor Mike',
  initials: 'MT', membershipId: null, orgId: null, teamId: null, studentName: null
};

let toastT: ReturnType<typeof setTimeout> | null = null;
let pushT: ReturnType<typeof setTimeout> | null = null;
let heldSinceMemo: number | null = null;

export function createAppStore(backend: Backend, membership: Membership, initial: MinistryData) {
  let docRetry: ReturnType<typeof setTimeout> | null = null;
  const store = createStore<AppState>()(
    immer((set, get) => {
      const leaderId = () => {
        const d = get().data;
        return standings(d.teams, d.cats, d.ledger)[0]?.id ?? null;
      };

      /** After an approved change moves the board: snapshot + lead-change push. */
      const afterBoardMoved = (leaderBefore: string | null) => {
        const d = get().data;
        const rows = standings(d.teams, d.cats, d.ledger);
        const now = rows[0];
        if (now && leaderBefore && now.id !== leaderBefore) {
          const prev = rows.find((r) => r.id === leaderBefore);
          get().firePush(now.name + ' just took the lead!', fmt(now.total) + ' pts — ' + fmt(now.total - (prev?.total ?? 0)) + ' ahead of ' + (prev?.name ?? ''), '/dashboard');
        }
      };

      const save = () => get().backend.saveSnapshot(get().data);

      const makeEntry = (input: AwardInput): LedgerEntry => {
        const m = get().membership;
        return {
          id: uid(),
          team: input.team,
          cat: input.cat,
          amount: Math.round(input.amount),
          by: input.by ?? m.displayName,
          byMembershipId: m.membershipId,
          why: input.why ?? '',
          at: Date.now(),
          /* Decided here and ONLY here. The database re-derives it from the
             real role on insert, so queueing never launders a role. */
          status: autoApproves(m.persona) ? 'approved' : 'pending',
          student: input.student ?? null,
          detail: input.detail ?? null,
          batch: input.batch ?? null,
          reverses: input.reverses ?? null
        };
      };

      const hold = (ops: HeldOp[]) => {
        set((s) => {
          s.outbox = mergeOutbox(s.outbox, ops);
        });
        for (const op of ops) {
          if (op.kind === 'entry') {
            const e = op.entry;
            const team = get().data.teams.find((t) => t.id === e.team)?.name ?? e.team;
            const cat = get().data.cats.find((c) => c.id === e.cat)?.label ?? e.cat;
            get().logActivity('Held offline: ' + (e.amount > 0 ? '+' : '') + fmt(e.amount) + ' ' + cat + ' → ' + team);
          }
        }
        get().persistHeld();
      };

      /** Post entries now: optimistic into the ledger, then to the backend.
       *  A failed push moves them back into the outbox — nothing is lost. */
      const postNow = (entries: LedgerEntry[]) => {
        const before = leaderId();
        set((s) => {
          const have = new Set(s.data.ledger.map((e) => e.id));
          s.data.ledger.unshift(...entries.filter((e) => !have.has(e.id)).reverse());
        });
        for (const e of entries) {
          const team = get().data.teams.find((t) => t.id === e.team)?.name ?? e.team;
          const cat = get().data.cats.find((c) => c.id === e.cat)?.label ?? e.cat;
          get().logActivity(
            (e.status === 'pending' ? 'Submitted for approval: ' : '') +
              (e.amount >= 0 ? '+' : '') + fmt(e.amount) + ' ' + cat + ' → ' + team + ' by ' + e.by + (e.why ? ' (' + e.why + ')' : '')
          );
        }
        if (entries.some((e) => e.status === 'approved')) afterBoardMoved(before);
        save();
        get()
          .backend.pushEntries(entries)
          .then(() => set((s) => { s.lastOnlineAt = Date.now(); }))
          .catch(() => {
            const ids = new Set(entries.map((e) => e.id));
            set((s) => {
              s.data.ledger = s.data.ledger.filter((e) => !ids.has(e.id));
            });
            hold(entries.map((entry) => ({ kind: 'entry' as const, id: entry.id, at: entry.at, entry })));
            get().say('Signal dropped before that could send. It is held on this phone and sends itself.');
          });
      };

      return {
        ready: false,
        backend,
        membership,
        data: initial,
        outbox: [],
        outboxSyncing: false,
        outboxError: '',
        staleHeld: null,
        netOnline: true,
        unsavedDocs: [],
        unsavedConfig: false,
        docSavedAt: {},
        offlineSim: false,
        lastOnlineAt: Date.now(),
        toast: null,
        push: null,
        roleSheetOpen: false,
        coachTeam: membership.teamId ?? initial.teams[0]?.id ?? '',
        boardOpen: null,

        hydrate(data) {
          set((s) => {
            s.data = data;
            s.ready = true;
            if (!data.teams.some((t) => t.id === s.coachTeam)) s.coachTeam = s.membership.teamId ?? data.teams[0]?.id ?? '';
          });
        },
        setMembership(m) {
          set((s) => {
            s.membership = m;
            if (m.teamId) s.coachTeam = m.teamId;
          });
        },
        setNetOnline(on) {
          const was = get().offline();
          set((s) => {
            s.netOnline = on;
            if (on) s.lastOnlineAt = Date.now();
          });
          if (was && !get().offline()) {
            get().flushOutbox();
            get().saveUnsavedDocs();
          }
        },

        async restoreHeld() {
          const raw = await readHeld();
          const { fresh, stale } = classifyRestored(raw);
          if (!fresh && !stale) {
            await removeHeld();
            return;
          }
          heldSinceMemo = fresh ? fresh.since : null;
          set((s) => {
            if (fresh) s.outbox = mergeOutbox(s.outbox, fresh.outbox);
            s.staleHeld = stale;
          });
          if (stale) {
            const n = heldTotal(stale);
            get().logActivity('Found ' + n + ' held item' + (n === 1 ? '' : 's') + ' from an earlier night — waiting on a decision');
          }
          /* Restored work is not decoration: with signal, drain it before the
             user does anything else. */
          if (fresh && !get().offline()) setTimeout(() => !get().offline() && get().flushOutbox(true), 800);
        },
        persistHeld(writeOnly) {
          const s = get();
          const payload = { outbox: s.outbox, chat: [], rsvp: [] };
          const has = !heldEmpty({ ...payload, since: 0 });
          if (!has && !s.staleHeld) {
            heldSinceMemo = null;
            if (!writeOnly) void removeHeld();
            return;
          }
          if (has && !heldSinceMemo) heldSinceMemo = heldSince(payload) ?? Date.now();
          const h = { ...payload, since: heldSinceMemo ?? Date.now(), stale: s.staleHeld };
          if (writeOnly) writeHeldSync(h);
          else void writeHeld(h);
        },

        offline() {
          const s = get();
          return !s.netOnline || s.offlineSim;
        },
        say(msg) {
          set((s) => {
            s.toast = { msg, key: Date.now() };
          });
          if (toastT) clearTimeout(toastT);
          toastT = setTimeout(() => set((s) => { s.toast = null; }), 2600);
        },
        sayPosted(onlineMsg, offlineMsg) {
          get().say(get().offline() ? offlineMsg : onlineMsg);
        },
        doneFlag() {
          return get().offline() ? 'held' : 'posted';
        },
        firePush(title, body, href) {
          set((s) => {
            s.push = { id: Date.now(), title, body, href };
          });
          if (pushT) clearTimeout(pushT);
          pushT = setTimeout(() => set((s) => { s.push = null; }), 4600);
        },
        logActivity(line, serverWrites = false) {
          const entry: ActivityLine = { id: uid(), line, at: Date.now() };
          set((s) => {
            s.data.activityLog.unshift(entry);
            if (s.data.activityLog.length > 200) s.data.activityLog.length = 200;
          });
          if (!(serverWrites && get().backend.mode === 'supabase')) get().emit({ kind: 'activity', line: entry });
        },
        emit(e) {
          /* Documents (the plan, reports, small groups…) and the ministry's
             settings are the exception: a save that can't go now is
             remembered and made again — from the newest copy, merged with
             anyone else's for a document — when it can. */
          const hold = () =>
            set((s) => {
              if (e.kind === 'doc') s.unsavedDocs = [...new Set([...s.unsavedDocs, e.key])];
              if (e.kind === 'config') s.unsavedConfig = true;
            });
          if (get().offline()) {
            hold();
            return;
          }
          const sent = get().backend.sync(e);
          if (e.kind === 'doc') void sent.then(() => set((s) => void (s.docSavedAt[e.key] = Date.now())), () => {});
          sent.catch(() => {
            /* Other non-score writes are not queued: the screens that make
               them say they need a connection rather than pretending to. */
            if (e.kind !== 'doc' && e.kind !== 'config') return;
            hold();
            if (!docRetry) docRetry = setTimeout(() => ((docRetry = null), get().saveUnsavedDocs()), 15_000);
          });
        },
        saveUnsavedDocs() {
          const keys = get().unsavedDocs;
          const config = get().unsavedConfig;
          if (get().offline() || (!keys.length && !config)) return;
          set((s) => {
            s.unsavedDocs = [];
            s.unsavedConfig = false;
          });
          for (const key of keys) get().emit({ kind: 'doc', key, value: get().data[key] });
          if (config) get().emit({ kind: 'config', config: get().data.config });
        },
        mutate(recipe) {
          set((s) => {
            recipe(s.data);
          });
          save();
        },

        base() {
          return pointBase(get().data.config);
        },

        award(input) {
          const s = get();
          const p = s.membership.persona;
          if (!canScore(p) && !(input.submission && p === 'captain')) {
            s.say('Your role reads the board. Scoring belongs to coaches, the scorekeeper and leaders.');
            return null;
          }
          const entry = makeEntry(input);
          if (s.offline()) {
            hold([{ kind: 'entry', id: entry.id, at: entry.at, entry }]);
            return 'held';
          }
          postNow([entry]);
          return 'posted';
        },

        awardMany(rows) {
          if (!rows.length) return null;
          const s = get();
          const p = s.membership.persona;
          if (!canScore(p) && !rows.every((r) => r.submission && p === 'captain')) {
            s.say('Your role reads the board. Scoring belongs to coaches, the scorekeeper and leaders.');
            return null;
          }
          const batch = uid();
          const base = Date.now();
          const entries = rows.map((r, i) => ({ ...makeEntry({ ...r, batch: r.batch ?? batch }), at: base + i }));
          if (s.offline()) {
            hold(entries.map((entry) => ({ kind: 'entry' as const, id: entry.id, at: entry.at, entry })));
            return 'held';
          }
          postNow(entries);
          return 'posted';
        },

        decide(ids, status) {
          const s = get();
          if (!canApprove(s.membership.persona)) {
            s.say('Only a ministry leader can clear the queue.');
            return null;
          }
          const by = s.membership.displayName;
          const at = Date.now();
          /* The decision is shown locally either way — the pastor's own board
             is allowed to move. Offline, the WRITE is held. */
          const before = leaderId();
          set((st) => {
            for (const e of st.data.ledger) {
              if (ids.includes(e.id) && e.status === 'pending') {
                e.status = status;
                e.decidedBy = by;
                e.decidedAt = at;
              }
            }
          });
          const decided = get().data.ledger.filter((e) => ids.includes(e.id));
          for (const e of decided) {
            const team = get().data.teams.find((t) => t.id === e.team)?.name ?? e.team;
            get().logActivity((status === 'approved' ? 'Approved ' : 'Sent back ') + (e.amount >= 0 ? '+' : '') + fmt(e.amount) + ' → ' + team + ' from ' + e.by);
          }
          if (status === 'approved') afterBoardMoved(before);
          save();
          if (s.offline()) {
            hold([{ kind: 'decide', id: uid(), at, ids, status, by }]);
            return 'held';
          }
          s.backend.decideEntries(ids, status, by).catch(() => {
            hold([{ kind: 'decide', id: uid(), at, ids, status, by }]);
          });
          return 'posted';
        },

        undoLast() {
          const s = get();
          const me = s.membership.displayName;
          /* Undo is open until the pastor approves an entry; for entries that
             skip the queue it closes at 24 hours. An undo is a REVERSAL — the
             ledger is append-only and the original stays in the audit log. */
          const reversed = new Set(s.data.ledger.map((e) => e.reverses).filter(Boolean) as string[]);
          const last = s.data.ledger.find(
            (e) => e.by === me && !e.reverses && !reversed.has(e.id) && e.status !== 'rejected' && Date.now() - e.at < 24 * 3600_000
          );
          const heldLast = [...s.outbox].reverse().find((o) => o.kind === 'entry' && o.entry.by === me && !o.entry.reverses);
          if (!last && !heldLast) {
            s.say('Nothing of yours to undo in the last 24 hours.');
            return;
          }
          const target = heldLast && (!last || heldLast.at > last.at) ? (heldLast as Extract<HeldOp, { kind: 'entry' }>).entry : last!;
          if (target.status === 'pending' && !heldLast) {
            /* Not approved yet: withdraw it rather than stacking a reversal. */
            set((st) => {
              const e = st.data.ledger.find((x) => x.id === target.id);
              if (e) {
                e.status = 'rejected';
                e.decidedBy = me + ' · withdrawn';
                e.decidedAt = Date.now();
              }
            });
            save();
            get().logActivity('Withdrew ' + fmt(target.amount) + ' before approval');
            if (!get().offline()) get().backend.decideEntries([target.id], 'rejected', me).catch(() => {});
            get().say('Withdrawn before anyone approved it.');
            return;
          }
          get().award({ team: target.team, cat: target.cat, amount: -target.amount, why: 'reversal of ' + (target.why || 'last entry'), by: me + ' · reversal', reverses: target.id, student: target.student });
          /* After the night closed, leaders already have a report with this
             in it: the reversal reaches them as a correction notice. */
          const h = get().data.huddle;
          if (h.nightClosed && h.closedAt && target.at <= h.closedAt && target.status === 'approved') {
            get().logActivity('Correction notice: ' + signed(-target.amount) + ' ' + (get().data.cats.find((c) => c.id === target.cat)?.label ?? target.cat) + ' for ' + (get().data.teams.find((t) => t.id === target.team)?.name ?? 'a squad') + ' after the night’s report');
            get().sayPosted('Reversal posted. The night’s report already went out, so leaders get a correction notice.', 'Reversal held until you have signal — the correction notice goes with it.');
            return;
          }
          get().sayPosted('Reversal posted. Original entry stays in the ledger.', 'Reversal held until you have signal. The original entry stays in the ledger.');
        },

        resendSoftHeld() {
          if (get().offline()) return;
          const { data, backend } = get();
          for (const [threadId, msgs] of Object.entries(data.chatMsgs)) {
            for (const msg of msgs) {
              if (msg.status !== 'pending') continue;
              backend
                .sync({ kind: 'chat', threadId, msg: { ...msg, status: 'sent' } })
                .then(() =>
                  get().mutate((d) => {
                    const m = d.chatMsgs[threadId]?.find((x) => x.id === msg.id);
                    if (m) {
                      m.status = 'sent';
                      delete m.heldAt;
                    }
                  })
                )
                .catch(() => undefined);
            }
          }
          for (const [eventId, answers] of Object.entries(data.rsvps)) {
            for (const [name, rec] of Object.entries(answers)) {
              if (!rec.heldAt) continue;
              backend
                .sync({ kind: 'rsvp', eventId, name, rec })
                .then(() =>
                  get().mutate((d) => {
                    const r = d.rsvps[eventId]?.[name];
                    if (r) delete r.heldAt;
                  })
                )
                .catch(() => undefined);
            }
          }
        },

        flushOutbox(quiet) {
          const s = get();
          s.resendSoftHeld();
          /* Guard 1 — one flush at a time, or two overlapping flushes replay
             the same rows twice. */
          if (s.outboxSyncing) return;
          const queued = s.outbox;
          if (!queued.length) {
            if (!quiet) s.say('Back online.');
            return;
          }
          set((st) => {
            st.outboxSyncing = true;
            st.outboxError = '';
          });
          const sent = replayOrder(queued);
          void (async () => {
            /* Guard 2 — re-check connectivity inside the async boundary. Signal
               can drop between starting a flush and the request landing; if it
               has, abort rather than replay into the offline guard. */
            await new Promise((r) => setTimeout(r, 600));
            if (get().offline()) {
              set((st) => {
                st.outboxSyncing = false;
                st.outboxError = 'Signal dropped before these could send. Nothing was lost — they are still held here.';
              });
              return;
            }
            try {
              for (const op of sent) {
                if (op.kind === 'entry') await get().backend.pushEntries([op.entry]);
                else await get().backend.decideEntries(op.ids, op.status, op.by);
              }
            } catch {
              set((st) => {
                st.outboxSyncing = false;
                st.outboxError = 'Signal dropped before these could send. Nothing was lost — they are still held here.';
              });
              return;
            }
            const before = leaderId();
            /* Guard 3 — clear by id, never `outbox = []`: anything queued while
               this flush was in flight has to survive it. */
            const sentIds = sent.map((o) => o.id);
            set((st) => {
              const have = new Set(st.data.ledger.map((e) => e.id));
              for (const op of sent) {
                if (op.kind === 'entry' && !have.has(op.entry.id)) st.data.ledger.unshift(op.entry);
              }
              st.outbox = withoutSent(st.outbox, sentIds);
              st.outboxSyncing = false;
              st.outboxError = '';
              st.lastOnlineAt = Date.now();
              /* The done-flags recorded how actions completed AT THE TIME. Once
                 the queue is actually empty they are no longer 'held'. */
              if (!st.outbox.length) {
                const t = st.data.tonight;
                for (const k of Object.keys(t.checkinPosted)) t.checkinPosted[k] = promoteFlag(t.checkinPosted[k]) as never;
                for (const k of Object.keys(t.pushed)) t.pushed[k] = promoteFlag(t.pushed[k]) as never;
                if (wasHeld(t.heatPosted)) t.heatPosted = 'posted';
              }
            });
            afterBoardMoved(before);
            const n = sent.length;
            get().logActivity('Synced ' + n + ' held entr' + (n === 1 ? 'y' : 'ies'));
            /* Draining moves work out of the held key and into the ledger —
               commit both now, or a successful sync is one killed tab away
               from vanishing. */
            save();
            get().persistHeld();
            get().say('Back online — sent ' + n + ' held entr' + (n === 1 ? 'y' : 'ies') + '.');
          })();
        },

        toggleOfflineSim() {
          const goingOffline = !get().offline();
          set((s) => {
            s.offlineSim = goingOffline;
            if (goingOffline) s.outboxError = '';
          });
          if (goingOffline) get().say('No signal. Points you award are held on this phone.');
          else {
            get().flushOutbox();
            get().saveUnsavedDocs();
          }
        },

        sendStaleHeld() {
          const p = get().staleHeld;
          if (!p) return;
          const n = heldTotal(p);
          heldSinceMemo = Date.now();
          set((s) => {
            s.outbox = mergeOutbox(s.outbox, p.outbox);
            s.staleHeld = null;
          });
          get().logActivity('Released ' + n + ' held item' + (n === 1 ? '' : 's') + ' from an earlier night');
          get().persistHeld();
          if (get().offline()) get().say('Back in the outbox. They send themselves when you have signal.');
          else get().flushOutbox();
        },
        discardStaleHeld() {
          const p = get().staleHeld;
          if (!p) return;
          const n = heldTotal(p);
          set((s) => {
            s.staleHeld = null;
          });
          get().persistHeld();
          get().logActivity('Discarded ' + n + ' held item' + (n === 1 ? '' : 's') + ' from an earlier night');
          get().say(n === 1 ? 'Discarded. It will not post.' : 'Discarded. Those ' + n + ' will not post.');
        },
        /** Demo affordance: the quarantine only appears when a phone opens with
         *  days-old work on it, which no reviewer can reach by tapping. */
        plantStaleHeld() {
          if (get().staleHeld) {
            get().discardStaleHeld();
            return;
          }
          const d = get().data;
          const since = Date.now() - 3 * 86_400_000;
          const mk = (team: string, cat: string, amount: number, by: string, why: string, at: number): HeldOp => {
            const id = uid();
            return { kind: 'entry', id, at, entry: { id, team, cat, amount, by, why, at, status: 'pending' } };
          };
          const payload: HeldPayload = {
            outbox: [
              mk(d.teams[0].id, d.cats[0].id, 150, 'Coach Marcus', 'brought two friends', since),
              mk(d.teams[1]?.id ?? d.teams[0].id, d.cats[1]?.id ?? d.cats[0].id, 100, get().membership.displayName, 'check-in', since + 60_000)
            ],
            chat: [],
            rsvp: [],
            since
          };
          set((s) => {
            s.staleHeld = mergeHeld(s.staleHeld, payload);
          });
          get().persistHeld();
          get().say('Planted a three-day-old held queue — see Home.');
        },

        setCoachTeam(id) {
          set((s) => {
            s.coachTeam = id;
          });
        },
        togglePresence(name) {
          if (!canEditRoster(get().membership.persona)) return;
          const on = !get().data.tonight.presence[name];
          get().setPresence(name, on);
        },
        setPresence(name, on, via = 'leader') {
          if (!canEditRoster(get().membership.persona)) return;
          set((s) => {
            s.data.tonight.via ??= {};
            if (on) {
              s.data.tonight.presence[name] = true;
              s.data.tonight.via[name] = via;
            } else {
              delete s.data.tonight.presence[name];
              delete s.data.tonight.via[name];
            }
          });
          save();
          get().emit({ kind: 'presence', date: get().data.tonight.date, student: name, present: on, via });
        },
        selfCheckIn() {
          const s = get();
          const name = s.membership.studentName;
          const kid = s.data.roster.find((r) => r.name === name);
          const ok = selfCheckin(s.data, kid, Date.now());
          if (!ok.ok || !name) {
            s.say(ok.why);
            return false;
          }
          set((st) => {
            st.data.tonight.presence[name] = true;
            st.data.tonight.via ??= {};
            st.data.tonight.via[name] = 'qr';
          });
          save();
          get().emit({ kind: 'selfCheckin', date: get().data.tonight.date });
          s.say('You’re in. Go find your squad.');
          return true;
        },
        markAllPresent(team, on) {
          if (!canEditRoster(get().membership.persona)) return;
          const names = get().data.roster.filter((r) => r.team === team).map((r) => r.name);
          set((s) => {
            for (const n of names) {
              if (on) s.data.tonight.presence[n] = true;
              else delete s.data.tonight.presence[n];
            }
          });
          save();
          for (const n of names) get().emit({ kind: 'presence', date: get().data.tonight.date, student: n, present: on });
        },
        postAttendance(team) {
          const s = get();
          const d = s.data;
          const rows = attendanceRows(d.roster, team, d.tonight.presence, d.cats, d.config.checkinAutoCats);
          if (!rows.length) {
            s.say('Mark who showed up first.');
            return null;
          }
          const count = new Set(rows.map((r) => r.student)).size;
          const sum = rows.reduce((n, r) => n + r.amount, 0);
          const flag = s.awardMany(rows.map((r) => ({ team, cat: r.cat, amount: r.amount, student: r.student, why: r.student + ' · checked in', by: s.membership.displayName + ' · check-in' })));
          if (!flag) return null;
          set((st) => {
            st.data.tonight.checkinPosted[team] = { count, held: flag === 'held' };
          });
          save();
          const teamName = d.teams.find((t) => t.id === team)?.name ?? team;
          const queued = !autoApproves(s.membership.persona);
          s.sayPosted(
            queued
              ? count + ' checked in — ' + fmt(sum) + ' pts sent to the youth pastor to approve.'
              : count + ' checked in — ' + fmt(sum) + ' pts to ' + teamName + '.',
            count + ' marked here — ' + fmt(sum) + ' pts held until you have signal.'
          );
          return flag;
        },

        setRoleSheet(open) {
          set((s) => {
            s.roleSheetOpen = open;
          });
        },
        setBoardOpen(id) {
          set((s) => {
            s.boardOpen = s.boardOpen === id ? null : id;
          });
        }
      };
    })
  );
  /* Any change to the ministry's data is kept (the demo's snapshot is
     debounced, and a no-op on Supabase, where each change syncs itself) —
     so a line logged just after a change isn't lost on reload. */
  store.subscribe((s, prev) => {
    if (s.data !== prev.data) s.backend.saveSnapshot(s.data);
  });
  return store;
}

export type AppStore = ReturnType<typeof createAppStore>;
export { blankMembership };
