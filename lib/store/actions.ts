'use client';
/* Multi-step actions that several screens share. Each one goes through the
   store's single award() entry point and carries the offline branch in its
   own confirmation — every caller's success message must tell the truth
   about whether the points landed. */
import {
  CHECKIN_PRESENT_PTS, CHECKIN_QUESTIONS, PROOF_BONUS, STUDENT_ITEMS, checkinQuestionPts, fmt, parseFriendNames,
  sheetDetail, sheetFriendCount, studentItemValue, verseCount, type SheetState, type ValueCtx
} from '@/lib/scoring';
import { autoApproves } from '@/lib/permissions';
import { chatStamp, teamOf } from '@/lib/selectors';
import { uid, type AppState } from '@/lib/store/app-store';
import { personaDef } from '@/lib/types/domain';
import type { Rsvp } from '@/lib/types/model';

type Get = () => AppState;

/** One path for achievements, so the toast, the audit line and the Badges
 *  screen can never disagree about what was earned. */
export function earnAchievement(get: Get, who: string, team: string, id: string, label: string, meta: string): boolean {
  const d = get().data;
  if (d.achievements.some((a) => a.id === id && a.who === who)) return false;
  get().mutate((x) => {
    x.achievements.unshift({ id, label, meta, who, team, at: Date.now() });
    if (x.achievements.length > 60) x.achievements.length = 60;
  });
  get().logActivity('Achievement unlocked: ' + label + ' — ' + who);
  return true;
}

export const valueCtx = (get: Get): ValueCtx => ({ base: get().base(), versePts: get().data.config.versePts, verseBoard: get().data.config.verseBoard });

/** The full per-student check-in sheet: one tap posts the points, the visitor
 *  names, the verse log and the achievements. Nothing is entered twice. */
export function postStudentSheet(get: Get, name: string, team: string, sh: SheetState, friendNames: string, whereOther: string): boolean {
  const s = get();
  const picked = STUDENT_ITEMS.filter((it) => sh.picks[it.id]);
  if (!name) {
    s.say('Pick a student first.');
    return false;
  }
  if (!picked.length) {
    s.say('Check what happened first.');
    return false;
  }
  /* Required PER FRIEND: the pastor follows these up one at a time. */
  const friendCount = sheetFriendCount(sh);
  const names = parseFriendNames(friendNames);
  if (friendCount > 0 && names.length < friendCount) {
    s.say(names.length ? 'Name all ' + friendCount + ' friends — the pastor follows up by name.' : 'Add the friend’s name(s) brought in.');
    return false;
  }
  const ctx = valueCtx(get);
  const where = sh.where === 'Somewhere else' ? whereOther || 'somewhere else' : sh.where;
  let sum = 0;
  const rows = picked.map((it) => {
    const pts = studentItemValue(it, sh, ctx);
    sum += pts;
    const count = it.expand === 'friends' ? Math.max(1, sh.counts[it.id] || 1) : 0;
    const articles = it.expand === 'articles' ? Math.max(1, sh.articles || 1) : 0;
    const verses = it.expand === 'verses' ? verseCount(it, sh, ctx) : 0;
    const why =
      name + ' · ' + it.label.toLowerCase() +
      (count > 1 ? ' ×' + count : '') +
      (verses ? ' · ' + verses + (verses === 1 ? ' verse' : ' verses') + ' × ' + fmt(ctx.versePts) : '') +
      (it.expand === 'proof' ? (sh.proof[it.id] ? ' · photo proof +' + fmt(PROOF_BONUS) : ' · on trust, no photo') : '') +
      (it.expand === 'where' && where ? ' · ' + where : '') +
      (articles ? ' · ' + articles + (articles === 1 ? ' article' : ' articles') + (articles >= 5 ? ' + full ensemble' : '') : '') +
      (it.cat === 'visitors' && names.length ? ' · ' + names.join(', ') : '');
    const detail = { ...(sheetDetail(it, sh, ctx) ?? {}), ...(it.cat === 'visitors' ? { friends: names } : {}), ...(it.expand === 'where' ? { place: where } : {}) };
    return { team, cat: it.cat, amount: pts, why, student: name, detail };
  });
  const flag = s.awardMany(rows);
  if (!flag) return false;

  if (sh.articles >= 5) earnAchievement(get, name, team, 'full_ensemble', 'Full Ensemble', 'Five pieces in the squad colour');
  const verseRows = picked.filter((it) => it.expand === 'verses');
  if (verseRows.length) {
    const total = verseRows.reduce((n, it) => n + verseCount(it, sh, ctx), 0);
    const wk = get().data.config.weekNumber;
    get().mutate((d) => {
      for (const it of verseRows) {
        const c = verseCount(it, sh, ctx);
        d.verseLog.unshift({ id: uid(), student: name, team, week: wk, set: it.verseSet ?? 'week', label: it.label, count: c, pts: ctx.versePts * c });
      }
    });
    if (total >= ctx.verseBoard) earnAchievement(get, name, team, 'verse_board', 'Cleared the Board', 'Recited every verse posted this week');
    else if (total >= 5) earnAchievement(get, name, team, 'verse_5', 'Word Keeper', 'Five or more verses in one night');
  }
  if (friendCount > 0) {
    const newFriends = STUDENT_ITEMS.filter((it) => it.friendKind === 'new' && sh.picks[it.id]).reduce((n, it) => n + Math.max(1, sh.counts[it.id] || 1), 0);
    if (newFriends >= 3) earnAchievement(get, name, team, 'recruiter_3', 'Full Carload', 'Three or more new friends in one night');
    else if (newFriends >= 1) earnAchievement(get, name, team, 'recruiter_1', 'Recruiter', 'Brought someone new to the ministry');
    get().mutate((d) => {
      d.visitorLog.unshift({ id: uid(), names, student: name, team, week: d.config.weekNumber, kind: newFriends > 0 ? 'new' : 'known', at: Date.now() });
    });
  }
  const queued = !autoApproves(s.membership.persona);
  s.sayPosted(
    fmt(sum) + ' logged for ' + name + ' across ' + picked.length + ' categories' + (queued ? ' — waiting on the youth pastor to approve.' : '.'),
    fmt(sum) + ' for ' + name + ' held until you have signal.'
  );
  return true;
}

/** Coach view's lighter per-student flow: present + the six questions. */
export function postCoachCheckin(get: Get, name: string, team: string, picks: Record<string, boolean>, visitors: string): boolean {
  const s = get();
  const picked = CHECKIN_QUESTIONS.filter((q) => picks[q.id]);
  if (picked.some((q) => q.cat === 'visitors') && !visitors.trim()) {
    s.say('Add the visitor’s name before you post it.');
    return false;
  }
  const base = s.base();
  const by = s.membership.displayName + ' · check-in';
  const rows = [
    { team, cat: 'general', amount: CHECKIN_PRESENT_PTS, why: name + ' · present', student: name, by },
    ...picked.map((q) => ({
      team,
      cat: q.cat,
      amount: checkinQuestionPts(q, base),
      why: name + ' · ' + q.label.toLowerCase() + (q.cat === 'visitors' ? ' · ' + visitors.trim() : ''),
      student: name,
      by,
      detail: q.cat === 'visitors' ? { friends: parseFriendNames(visitors) } : null
    }))
  ];
  const sum = rows.reduce((n, r) => n + r.amount, 0);
  const flag = s.awardMany(rows);
  if (!flag) return false;
  get().mutate((d) => {
    d.tonight.presence[name] = true;
    d.tonight.checkinDetail[name] = { pts: sum, count: picked.length, picks: { ...picks }, visitors };
    if (picked.some((q) => q.cat === 'visitors')) {
      d.visitorLog.unshift({ id: uid(), names: parseFriendNames(visitors), student: name, team, week: d.config.weekNumber, kind: 'new', at: Date.now() });
    }
  });
  get().emit({ kind: 'presence', date: get().data.tonight.date, student: name, present: true });
  const queued = !autoApproves(s.membership.persona);
  s.sayPosted(
    name + ' checked in — ' + fmt(sum) + ' pts ' + (queued ? 'sent for approval.' : 'to ' + teamOf(get().data, team).name + '.'),
    name + ' marked here — ' + fmt(sum) + ' pts held until you have signal.'
  );
  return true;
}

/* ── chat and RSVPs ──────────────────────────────────────────────────────
   Not points, so not the outbox: sent straight away, or kept on the phone
   marked held and resent by resendSoftHeld() when signal returns. */
export function sendChat(get: Get, threadId: string, text: string): void {
  const s = get();
  const body = text.trim();
  if (!body) return;
  const at = Date.now();
  const m = s.membership;
  const held = s.offline();
  const msg = {
    id: uid(), at, ...chatStamp(at), from: m.displayName, roleLabel: personaDef(m.persona).label, text: body, mine: true,
    status: held ? ('pending' as const) : ('sent' as const), heldAt: held ? at : undefined
  };
  s.mutate((d) => void (d.chatMsgs[threadId] ??= []).push(msg));
  if (held) return;
  s.backend.sync({ kind: 'chat', threadId, msg }).catch(() =>
    get().mutate((d) => {
      const x = d.chatMsgs[threadId]?.find((y) => y.id === msg.id);
      if (x) {
        x.status = 'pending';
        x.heldAt = Date.now();
      }
    })
  );
}

export function sendRsvp(get: Get, eventId: string, name: string, rec: Rsvp): void {
  const s = get();
  const held = s.offline();
  const next: Rsvp = { status: rec.status, guests: rec.guests, ...(held ? { heldAt: Date.now() } : {}) };
  s.mutate((d) => void ((d.rsvps[eventId] ??= {})[name] = next));
  if (held) return;
  s.backend.sync({ kind: 'rsvp', eventId, name, rec: next }).catch(() =>
    get().mutate((d) => {
      const r = d.rsvps[eventId]?.[name];
      if (r) r.heldAt = Date.now();
    })
  );
}
