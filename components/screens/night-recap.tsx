'use client';
/* NIGHT RECAP — the night, after (and during) it. Attendance: who is in and
   how they got in, first-time visitors added at the door with a guardian, and
   anyone the kiosk flagged. Follow-ups: built from the night itself the
   moment it wraps — welcomes, missed-you check-ins, prayer and thank-yous —
   each owned by one person and due within 48 hours. Notes: what went well
   and what to change. */
import { useMemo, useState } from 'react';
import { PreviewClock, Seg, Tick } from '@/components/cycle/bits';
import { useCycle, useNightSave } from '@/components/cycle/use-cycle';
import { PcoCheckInsButton } from '@/components/pco';
import { QrCode } from '@/components/qr-code';
import { Sheet } from '@/components/sheet';
import { Btn, Chip, EmptyNote, Icon, Label, Screen, ScreenHeader, Stat } from '@/components/ui';
import { FU_KINDS, attendanceStats, checkinOpen, clock, dayLabel, dueLine, followups, isAfter, newFamilyToken, weekday, type FollowUp } from '@/lib/cycle';
import { weekOf } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useAppApi } from '@/lib/store/provider';
import type { Student } from '@/lib/types/model';

type Tab = 'att' | 'fu' | 'notes';

export function NightRecapScreen({ bare }: { bare?: boolean } = {}) {
  const c = useCycle();
  const after = isAfter(c.t, c.now);
  const [tab, setTab] = useState<Tab | null>(null);
  const cur: Tab = tab ?? (after ? 'fu' : 'att');
  return (
    <Screen label="Night recap">
      {!bare ? <ScreenHeader title="Recap" sub={after ? dueLine(c.t, c.now) : dayLabel(c.t.setup) + ' · attendance, follow-ups, notes'} back="/dashboard/more" /> : null}
      <PreviewClock t={c.t} stages={c.stages} current={c.preview?.id ?? null} mode={c.m.mode} />
      <Seg
        value={cur}
        onChange={setTab}
        options={[
          { id: 'att', label: 'Attendance' },
          { id: 'fu', label: 'Follow-ups' },
          { id: 'notes', label: 'Notes' }
        ]}
      />
      {cur === 'att' ? <AttendanceTab /> : cur === 'fu' ? <FollowupsTab /> : <NotesTab />}
    </Screen>
  );
}

/* ── attendance ──────────────────────────────────────────────────────── */
function AttendanceTab() {
  const { d, m, iso, night, t, now } = useCycle();
  const api = useAppApi();
  const saveNight = useNightSave();
  const [q, setQ] = useState('');
  const [team, setTeam] = useState<string>('all');
  const [qr, setQr] = useState(false);
  const [v, setV] = useState({ name: '', guardian: '', contact: '', team: '' });
  const stats = attendanceStats(d);
  const open = checkinOpen(t, now) || isAfter(t, now);
  const flags = night.doorFlags.filter((f) => !f.done);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const guests = new Set(d.roster.filter((s) => s.guest).map((s) => s.name));
  const needle = q.trim().toLowerCase();
  const people = d.roster
    .filter((s) => (team === 'all' || s.team === team) && (!needle || s.name.toLowerCase().includes(needle)))
    .sort((a, b) => Number(!!d.tonight.presence[b.name]) - Number(!!d.tonight.presence[a.name]) || a.name.localeCompare(b.name));
  const shown = needle || team !== 'all' ? people : people.slice(0, 40);

  const addVisitor = () => {
    const name = v.name.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (d.roster.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      api().say(name + ' is already on a roster — tap them in from the list.');
      return;
    }
    const student: Student = { id: uid(), name, team: v.team || null, grade: '', guest: true, newInDb: true };
    const family = { guardian: v.guardian.trim(), contact: v.contact.trim(), token: newFamilyToken() };
    api().mutate((x) => {
      x.roster.push(student);
      if (family.guardian || family.contact) x.families[name] = family;
    });
    api().emit({ kind: 'student', student });
    if (family.guardian || family.contact) api().emit({ kind: 'family', student: name, family });
    api().setPresence(name, true, 'leader');
    api().logActivity('First-time visitor checked in: ' + name + (family.guardian ? ' · guardian ' + family.guardian : ''));
    const flag = flags.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (flag) resolveFlag(flag.id);
    setV({ name: '', guardian: '', contact: '', team: '' });
    api().say(name + ' is checked in. A welcome follow-up is ready after the night.');
  };

  const resolveFlag = (id: string) => {
    const f = night.doorFlags.find((x) => x.id === id);
    if (!f) return;
    saveNight(iso, (n) => void (n.doorFlags = n.doorFlags.map((x) => (x.id === id ? { ...x, done: true } : x))));
    api().emit({ kind: 'doorFlag', date: iso, flag: { ...f, done: true } });
  };

  return (
    <>
      <div className="flex gap-[9px]">
        <Stat label="Here" value={open ? String(stats.here) : '–'} hint={open ? 'of ' + stats.total : 'not open yet'} />
        <Stat label="At the door" value={open ? String(stats.qr) : '–'} hint="QR or kiosk" />
        <Stat label="New" value={String(stats.visitors)} hint="first time" />
      </div>

      {!open ? (
        <div className="text-[12px] leading-[1.5] text-neutral-400 text-pretty">
          Check-in opens at {clock(t.checkinOpen)} on {weekday(iso)}. Students scan the door QR with their phone or use the door kiosk, or you tap them in here.
        </div>
      ) : null}

      <div className="flex gap-2">
        <Btn variant="secondary" className="flex-1 justify-center text-[12px]" onClick={() => setQr(true)}>
          <Icon name="ph ph-qr-code" className="mr-[6px] text-[15px]" />
          Door QR
        </Btn>
        <Btn variant="secondary" className="flex-1 justify-center text-[12px]" href="/dashboard/door">
          <Icon name="ph ph-device-tablet" className="mr-[6px] text-[15px]" />
          Door kiosk
        </Btn>
      </div>

      {flags.map((f) => (
        <div key={f.id} className="flex items-start gap-[10px] rounded-lg border border-accent-600 px-[13px] py-[11px]" style={{ background: 'color-mix(in srgb, var(--color-accent) 9%, transparent)' }}>
          <Icon name="ph ph-door-open" className="mt-[1px] flex-none text-[17px] text-accent-300" />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium leading-[1.3] text-neutral-100">{f.name} is at the door</div>
            <div className="mt-[2px] text-[11px] leading-[1.4] text-neutral-400">Not on any roster · flagged {clock(f.at)}. Go say hi, then add them below.</div>
            <div className="mt-2 flex gap-2">
              <Btn variant="secondary" className="px-3 text-[12px]" onClick={() => setV((x) => ({ ...x, name: f.name }))}>
                Add as visitor
              </Btn>
              <Btn variant="ghost" className="px-3 text-[12px] text-neutral-400" onClick={() => resolveFlag(f.id)}>
                Handled
              </Btn>
            </div>
          </div>
        </div>
      ))}

      <PcoCheckInsButton />

      {open && m.mode === 'demo' ? (
        <Btn
          variant="ghost"
          className="justify-center text-[12px] text-neutral-400"
          onClick={() => {
            for (const s of d.roster.filter((r) => !r.guest && !d.tonight.presence[r.name]).slice(0, 2)) api().setPresence(s.name, true, 'qr');
          }}
        >
          <Icon name="ph ph-scan" className="mr-[6px] text-[14px]" />
          Simulate 2 QR scans
        </Btn>
      ) : null}

      <div className="flex flex-col gap-2">
        <input className="input" placeholder="Find a student" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a student" />
        <div className="-mx-[18px] flex gap-[6px] overflow-x-auto px-[18px]" style={{ scrollbarWidth: 'none' }}>
          <Chip label="All" on={team === 'all'} onClick={() => setTeam('all')} />
          {d.teams.map((tm) => (
            <Chip key={tm.id} label={tm.name} color={tm.color} on={team === tm.id} onClick={() => setTeam(tm.id)} count={d.roster.filter((r) => r.team === tm.id && d.tonight.presence[r.name]).length} />
          ))}
        </div>
      </div>
      <div className="sr-card overflow-hidden">
        {shown.map((s, i) => {
          const here = !!d.tonight.presence[s.name];
          const via = d.tonight.via?.[s.name];
          return (
            <button
              key={s.id}
              onClick={() => api().setPresence(s.name, !here, 'leader')}
              aria-pressed={here}
              className="flex min-h-11 w-full items-center gap-[11px] px-[14px] py-[7px] text-left sr-hover"
              style={{ borderTop: i ? '1px solid var(--color-divider)' : undefined }}
            >
              <Tick on={here} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] leading-[1.3]" style={{ color: here ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)' }}>
                {s.name}
                {guests.has(s.name) ? <span className="text-neutral-500"> · guest</span> : null}
              </span>
              <span className="text-[10.5px]" style={{ color: via === 'qr' ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                {here ? (via === 'qr' ? 'Door' : via === 'pco' ? 'Check-in' : 'Tapped') : ''}
              </span>
            </button>
          );
        })}
        {!shown.length ? <div className="px-[14px] py-4 text-[12px] text-neutral-500">Nobody by that name. Add them as a first-time visitor below.</div> : null}
        {shown.length < people.length ? (
          <div className="border-t border-divider px-[14px] py-[10px] text-[11px] text-neutral-500">
            Showing {shown.length} of {people.length}. Search or pick a squad for the rest.
          </div>
        ) : null}
      </div>

      <div className="sr-card flex flex-col gap-2 px-[14px] py-[13px]">
        <Label>First-time visitor</Label>
        <input className="input" placeholder="Student name" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} aria-label="Visitor name" />
        <input className="input" placeholder="Parent or guardian" value={v.guardian} onChange={(e) => setV({ ...v, guardian: e.target.value })} aria-label="Guardian" />
        <input className="input" placeholder="Their phone or email" value={v.contact} onChange={(e) => setV({ ...v, contact: e.target.value })} aria-label="Guardian contact" />
        <select className="input" value={v.team} onChange={(e) => setV({ ...v, team: e.target.value })} aria-label="Squad">
          <option value="">Squad: decide later</option>
          {d.teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </select>
        <Btn className="justify-center" disabled={!v.name.trim()} onClick={addVisitor}>
          Check them in
        </Btn>
        <div className="text-[10.5px] leading-[1.45] text-neutral-500 text-pretty">The guardian’s details are seen by coaches and leaders only, and give the family their own link.</div>
      </div>

      <Sheet open={qr} onClose={() => setQr(false)} label="Door QR">
        <div className="flex flex-col items-center gap-3 pb-2 text-center">
          <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">Scan to check in</div>
          <QrCode url={origin + '/dashboard/here'} label="Door check-in QR code" size={200} />
          <div className="text-[12px] leading-[1.5] text-neutral-400 text-pretty">
            Students open it signed in on their own phone. It works from {clock(t.checkinOpen)} until the night wraps. Anyone not on a roster is told to find a leader.
          </div>
          <div className="break-all text-[11px] text-neutral-500">{origin}/dashboard/here</div>
        </div>
      </Sheet>
    </>
  );
}

/* ── follow-ups ──────────────────────────────────────────────────────── */
function FollowupsTab() {
  const { d, iso, t, now, me } = useCycle();
  const api = useAppApi();
  const saveNight = useNightSave();
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const list = useMemo(() => followups(d, iso, now, me), [d, iso, now, me]);
  const after = isAfter(t, now);
  const shown = list.filter((f) => filter === 'all' || f.mine);
  const left = shown.filter((f) => !f.done).length;

  const mark = (f: FollowUp, done: boolean, text?: string) => {
    const rec = { done, at: done ? now : 0, text: text ?? f.text, by: me.name };
    saveNight(iso, (n) => void (n.fu[f.id] = rec));
    api().emit({ kind: 'followup', date: iso, id: f.id, rec });
  };
  /* Only the welcome is written to a guardian, so only it offers their number. */
  const phoneFor = (f: FollowUp): { who: string; num: string } | null => {
    if (f.kind !== 'welcome') return null;
    const fam = d.families[f.id.slice(2)];
    const num = fam?.contact.replace(/[^\d+]/g, '') ?? '';
    return fam && num.length >= 7 ? { who: fam.guardian || 'the family', num } : null;
  };

  return (
    <>
      <div className="text-[11.5px] leading-[1.4]" style={{ color: now > t.due ? 'var(--color-accent-200)' : 'var(--color-neutral-500)' }}>
        {after ? dueLine(t, now) : 'Due within ' + d.config.cycle.followupHours + ' hours of the night'}
      </div>
      {!after ? (
        <EmptyNote>The list builds itself when the night wraps at {clock(t.end)}: visitor welcomes, missed-you check-ins, prayer follow-ups and thank-yous to the crew.</EmptyNote>
      ) : (
        <>
          <Seg
            small
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'mine', label: 'Mine · ' + list.filter((f) => f.mine && !f.done).length },
              { id: 'all', label: 'Everyone · ' + list.filter((f) => !f.done).length }
            ]}
          />
          {!shown.length ? <EmptyNote>{filter === 'mine' ? 'Nothing is yours from this night.' : 'Nothing to follow up on.'}</EmptyNote> : null}
          {left === 0 && shown.length ? <div className="text-[12px] text-accent-300">All done. Thank you.</div> : null}
          {shown.map((f) => {
            const isOpen = openId === f.id;
            const text = drafts[f.id] ?? f.text;
            const phone = phoneFor(f);
            return (
              <div key={f.id} className="sr-card flex gap-[11px] px-[14px] py-3">
                <button onClick={() => !f.private && mark(f, !f.done)} disabled={f.private} aria-pressed={f.done} aria-label={f.done ? 'Mark not done' : 'Mark done'} className="flex h-11 w-7 flex-none items-start justify-center pt-[1px]">
                  <Tick on={f.done} locked={f.private} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="flex-1 text-[13px] font-medium leading-[1.3]" style={{ color: f.done ? 'var(--color-neutral-500)' : 'var(--color-neutral-100)', textDecoration: f.done ? 'line-through' : 'none' }}>
                      {f.title}
                    </span>
                    <span className="flex-none text-[10.5px]" style={{ color: f.mine ? 'var(--color-accent-300)' : 'var(--color-neutral-500)' }}>
                      {f.mine ? 'You' : f.owner ?? 'Leaders'}
                    </span>
                  </div>
                  <div className="mt-[3px] text-[11px] leading-[1.45] text-neutral-500 text-pretty">
                    {FU_KINDS.find((k) => k.id === f.kind)?.label} · {f.sub}
                  </div>
                  {!f.private && !f.done && f.draft ? (
                    <button onClick={() => setOpenId(isOpen ? null : f.id)} aria-expanded={isOpen} className="mt-[6px] min-h-8 text-[11.5px] font-medium text-accent-300">
                      {isOpen ? 'Close draft' : 'Draft a message'}
                    </button>
                  ) : null}
                  {isOpen ? (
                    <div className="mt-2 flex flex-col gap-2">
                      <textarea className="input min-h-[88px] py-2 text-[12.5px] leading-[1.5]" value={text} onChange={(e) => setDrafts((x) => ({ ...x, [f.id]: e.target.value }))} aria-label={'Message for ' + f.title} />
                      <div className="flex gap-2">
                        {phone ? (
                          <Btn
                            className="flex-1 justify-center text-[12px]"
                            href={'sms:' + phone.num + '?&body=' + encodeURIComponent(text)}
                            ariaLabel={'Text ' + phone.who}
                          >
                            Text {phone.who.split(' ')[0]}
                          </Btn>
                        ) : null}
                        <Btn
                          variant={phone ? 'secondary' : 'primary'}
                          className="flex-1 justify-center text-[12px]"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(text);
                            } catch {
                              /* the text is still saved on the item */
                            }
                            mark(f, true, text);
                            setOpenId(null);
                            api().say('Copied and marked done.');
                          }}
                        >
                          Copy & mark done
                        </Btn>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </>
      )}
    </>
  );
}

/* ── notes ───────────────────────────────────────────────────────────── */
function NotesTab() {
  const { d, iso, night } = useCycle();
  const api = useAppApi();
  const saveNight = useNightSave();
  const [well, setWell] = useState(night.notes.well);
  const [change, setChange] = useState(night.notes.change);
  const week = weekOf(d.config.meetingDates, iso);
  const debrief = d.huddle.debriefNotes.filter((n) => n.week === week);
  const commit = () => {
    const notes = { well: well.trim(), change: change.trim() };
    if (notes.well === night.notes.well && notes.change === night.notes.change) return;
    saveNight(iso, (n) => void (n.notes = notes));
    api().emit({ kind: 'nightNotes', date: iso, notes });
  };
  return (
    <>
      <label className="flex flex-col gap-[6px]">
        <Label>What went well</Label>
        <textarea className="input min-h-[96px] py-2 text-[13px] leading-[1.5]" value={well} onChange={(e) => setWell(e.target.value)} onBlur={commit} placeholder="The relay pulled the new kids in fast" />
      </label>
      <label className="flex flex-col gap-[6px]">
        <Label>Change next time</Label>
        <textarea className="input min-h-[96px] py-2 text-[13px] leading-[1.5]" value={change} onChange={(e) => setChange(e.target.value)} onBlur={commit} placeholder="The lesson ran six minutes long again" />
      </label>
      <div className="text-[11px] leading-[1.5] text-neutral-500">Saves when you leave the box. Every leader’s recap shows the same notes.</div>
      {debrief.length ? (
        <div className="sr-card flex flex-col gap-2 px-[14px] py-3">
          <Label>From the 8:50 debrief</Label>
          {debrief.map((n) => (
            <div key={n.id} className="text-[12.5px] leading-[1.5] text-neutral-300 text-pretty">
              {n.text}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
