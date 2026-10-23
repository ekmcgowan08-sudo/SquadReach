'use client';
/* DOOR — two ways in at the door.
   The kiosk: a leader's tablet at the entrance. A student types their name
   and taps it. Someone not on any roster doesn't add themselves (decided in
   review) — they flag a leader, who comes over.
   Here: what the door QR opens on a student's own phone. One tap, their own
   name, only while check-in is open. */
import { useState } from 'react';
import { useCycle, useNightSave } from '@/components/cycle/use-cycle';
import { Btn, EmptyNote, Icon, Screen, ScreenHeader } from '@/components/ui';
import { checkinOpen, clock, coachFor, selfCheckin } from '@/lib/cycle';
import { nowMs } from '@/lib/dates';
import { uid } from '@/lib/store/app-store';
import { useAppApi } from '@/lib/store/provider';

export function DoorKioskScreen() {
  const { d, iso, t, now } = useCycle();
  const api = useAppApi();
  const saveNight = useNightSave();
  const [q, setQ] = useState('');
  const [pick, setPick] = useState<string | null>(null);
  const [done, setDone] = useState<{ name: string; line: string } | null>(null);
  const [lost, setLost] = useState(false);
  const [lostName, setLostName] = useState('');
  const open = checkinOpen(t, now);
  const needle = q.trim().toLowerCase();
  const matches = needle.length < 2 ? [] : d.roster.filter((s) => s.name.toLowerCase().split(' ').some((w) => w.startsWith(needle)) || s.name.toLowerCase().startsWith(needle)).slice(0, 8);

  const reset = () => {
    setQ('');
    setPick(null);
    setLost(false);
    setLostName('');
  };
  const checkIn = (name: string) => {
    const s = d.roster.find((r) => r.name === name);
    if (!d.tonight.presence[name]) api().setPresence(name, true, 'qr');
    const team = d.teams.find((x) => x.id === s?.team);
    const coach = coachFor(d, s?.team ?? null, name);
    setDone({ name, line: team ? 'You’re ' + team.name + (coach ? ' with ' + coach : '') + '. Go find your squad.' : 'Grab a leader and they’ll get you to a squad.' });
    reset();
    window.setTimeout(() => setDone(null), 4000);
  };
  const flag = () => {
    const name = lostName.trim();
    if (!name) return;
    const f = { id: uid(), name, at: nowMs() };
    saveNight(iso, (n) => void n.doorFlags.push(f));
    api().emit({ kind: 'doorFlag', date: iso, flag: f });
    api().firePush('Someone new at the door', name + ' isn’t on a roster — go say hi', '/dashboard/night-recap');
    setDone({ name, line: 'A leader is on the way. Hang tight right here.' });
    reset();
    window.setTimeout(() => setDone(null), 5000);
  };

  return (
    <Screen label="Door kiosk">
      <ScreenHeader title="Door check-in" sub={d.config.ministryName + (open ? ' · open until ' + clock(t.end) : ' · opens ' + clock(t.checkinOpen))} back="/dashboard/night-recap" />
      {done ? (
        <div className="sr-card flex flex-col items-center gap-3 px-5 py-10 text-center" role="status" aria-live="polite">
          <Icon name="ph-fill ph-check-circle" className="text-[44px] text-accent-300" />
          <div className="text-[22px] font-medium leading-[1.2] text-neutral-100">Welcome, {done.name.split(' ')[0]}!</div>
          <div className="text-[13.5px] leading-[1.5] text-neutral-400 text-pretty">{done.line}</div>
        </div>
      ) : pick ? (
        <div className="sr-card flex flex-col gap-4 px-5 py-8 text-center">
          <div className="text-[13px] text-neutral-400">Is this you?</div>
          <div className="text-[24px] font-medium leading-[1.2] text-neutral-100">{pick}</div>
          <Btn className="min-h-[52px] justify-center text-[15px]" onClick={() => checkIn(pick)}>
            Yes, check me in
          </Btn>
          <Btn variant="ghost" className="justify-center text-neutral-400" onClick={() => setPick(null)}>
            That’s not me
          </Btn>
        </div>
      ) : lost ? (
        <div className="sr-card flex flex-col gap-3 px-5 py-6">
          <div className="text-[17px] font-medium leading-[1.3] text-neutral-100">Welcome! What’s your name?</div>
          <input className="input min-h-[52px] text-[16px]" value={lostName} onChange={(e) => setLostName(e.target.value)} placeholder="First and last name" aria-label="Your name" autoFocus />
          <Btn className="min-h-[52px] justify-center text-[15px]" disabled={!lostName.trim()} onClick={flag}>
            Get a leader
          </Btn>
          <Btn variant="ghost" className="justify-center text-neutral-400" onClick={reset}>
            Back
          </Btn>
        </div>
      ) : (
        <>
          {!open ? <div className="text-[12px] leading-[1.5] text-neutral-500">Check-in opens at {clock(t.checkinOpen)}. You can still check someone in by hand.</div> : null}
          <input className="input min-h-[56px] text-[18px]" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type your first or last name" aria-label="Type your name" autoComplete="off" />
          <div className="flex flex-col gap-2">
            {matches.map((s) => {
              const here = !!d.tonight.presence[s.name];
              return (
                <button key={s.id} onClick={() => (here ? setDone({ name: s.name, line: 'You’re already checked in. Have a great night.' }) : setPick(s.name))} className="sr-card flex min-h-[56px] items-center gap-3 px-4 text-left sr-hover">
                  <span className="flex-1 text-[16px] font-medium text-neutral-100">{s.name}</span>
                  {here ? <span className="text-[12px] text-accent-300">Checked in</span> : <Icon name="ph ph-caret-right" className="text-[14px] text-neutral-500" />}
                </button>
              );
            })}
            {needle.length >= 2 && !matches.length ? <EmptyNote>No one by that name yet.</EmptyNote> : null}
          </div>
          <Btn variant="secondary" className="min-h-[52px] justify-center" onClick={() => setLost(true)}>
            I’m new / I’m not on the list
          </Btn>
        </>
      )}
    </Screen>
  );
}

export function HereScreen() {
  const { d, m, t, now } = useCycle();
  const api = useAppApi();
  const kid = d.roster.find((r) => r.name === m.studentName);
  const status = selfCheckin(d, kid, now);
  const here = !!(kid && d.tonight.presence[kid.name]);
  return (
    <Screen label="Check in">
      <ScreenHeader title="Check in" sub={d.config.ministryName} back="/dashboard" />
      {!m.studentName ? (
        <EmptyNote>This is the students’ door check-in. Leaders check people in from the recap or the door kiosk.</EmptyNote>
      ) : here ? (
        <div className="sr-card flex flex-col items-center gap-2 px-5 py-8 text-center">
          <Icon name="ph-fill ph-check-circle" className="text-[40px] text-accent-300" />
          <div className="text-[20px] font-medium text-neutral-100">You’re in, {m.firstName}.</div>
          <div className="text-[13px] text-neutral-400">Pickup is at {clock(t.pickup)} at the {d.config.cycle.pickupPlace}.</div>
        </div>
      ) : status.ok ? (
        <div className="sr-card flex flex-col items-center gap-4 px-5 py-8 text-center">
          <div className="text-[20px] font-medium text-neutral-100">Here tonight, {m.firstName}?</div>
          <Btn className="min-h-[52px] w-full justify-center text-[15px]" onClick={() => api().selfCheckIn()}>
            Check me in
          </Btn>
        </div>
      ) : (
        <EmptyNote>{status.why}</EmptyNote>
      )}
    </Screen>
  );
}
