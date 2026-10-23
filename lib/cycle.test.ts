import { describe, expect, it } from 'vitest';
import {
  atLocal, audienceKids, countdown, cycleNeeds, familyFeed, followups, history, myNights, nightTimes, openSpots, reminders, selfCheckin,
  selfName, span, upcomingNights
} from '@/lib/cycle';
import { demoMinistry } from '@/lib/data/seed';
import type { MinistryData } from '@/lib/types/model';

const NIGHT = '2026-10-28';
const fresh = (): MinistryData => demoMinistry(atLocal('2026-10-23', '12:00'));
const leader = { name: 'Mike Torres', leader: true };

describe('the clock', () => {
  it('drops zero parts from durations', () => {
    expect(span(3 * 86_400_000)).toBe('3 days');
    expect(span(2 * 3_600_000 + 10 * 60_000)).toBe('2 hr 10 min');
    expect(span(25 * 60_000)).toBe('25 min');
  });

  it('counts down to setup, then live, then the follow-up window', () => {
    const d = fresh();
    const t = nightTimes(d.config.cycle, NIGHT);
    expect(countdown(t, t.setup - 3_600_000).phase).toBe('prep');
    expect(countdown(t, t.doors + 60_000).big).toBe('Live now');
    expect(countdown(t, t.end + 60_000).phase).toBe('recap');
    expect(countdown(t, t.due + 60_000).big).toBe('Past due');
  });

  it('keeps meeting weekly past the end of the season', () => {
    expect(upcomingNights(['2026-10-21', '2026-10-28'], '2026-10-23', 3)).toEqual(['2026-10-28', '2026-11-04', '2026-11-11']);
  });
});

describe('reminders', () => {
  it('post when their time passes, unless switched off', () => {
    const d = fresh();
    const t = nightTimes(d.config.cycle, NIGHT);
    const before = reminders(d, NIGHT, atLocal('2026-10-24', '12:00'));
    expect(before.every((r) => !r.sent)).toBe(true);
    const dayBefore = reminders(d, NIGHT, atLocal('2026-10-27', '12:00'));
    expect(dayBefore.filter((r) => r.sent).map((r) => r.id)).toEqual(['r3', 'r1']);
    d.cycle[NIGHT] = { rem: { r1: { off: true } }, fu: {}, notes: { well: '', change: '' }, pickupShift: 0, doorFlags: [] };
    expect(reminders(d, NIGHT, t.setup).find((r) => r.id === 'r1')?.sent).toBe(false);
  });

  it('fill the template from the night itself', () => {
    const d = fresh();
    const r = reminders(d, NIGHT, 0).find((x) => x.id === 'rm')!;
    expect(r.text).toContain('6:45 pm');
    expect(r.text).toContain('lobby doors');
  });
});

describe('follow-ups', () => {
  it('are empty until the night wraps', () => {
    const d = fresh();
    const t = nightTimes(d.config.cycle, NIGHT);
    expect(followups(d, NIGHT, t.end - 60_000, leader)).toEqual([]);
  });

  it('check in on regulars who were missing, and only regulars', () => {
    const d = fresh();
    const t = nightTimes(d.config.cycle, NIGHT);
    const list = followups(d, NIGHT, t.end + 60_000, leader).filter((f) => f.kind === 'missed');
    expect(list.length).toBeGreaterThan(0);
    for (const f of list) {
      const name = f.id.slice(2);
      const h = history(d, name, NIGHT);
      expect(h.filter(Boolean).length * 2).toBeGreaterThanOrEqual(h.length);
    }
  });

  it('welcome a first-timer once and give it to their squad’s coach', () => {
    const d = fresh();
    d.roster.push({ id: 'v1', name: 'Kai Bennett', team: 'yellow', grade: '8', guest: true, newInDb: true });
    d.tonight.presence['Kai Bennett'] = true;
    const t = nightTimes(d.config.cycle, NIGHT);
    const w = followups(d, NIGHT, t.end + 60_000, leader).filter((f) => f.id === 'w-Kai Bennett');
    expect(w).toHaveLength(1);
    expect(['Chris Alder', 'Dana Boyd', 'Beth Naylor']).toContain(w[0].owner);
  });

  it('keep prayer private from anyone who is not a leader', () => {
    const d = fresh();
    const t = nightTimes(d.config.cycle, NIGHT);
    d.prayerQueue.push({ id: 'pq', who: 'Maya Ruiz', meta: '', body: 'Her grandmother has surgery Friday.', at: t.doors + 30 * 60_000 });
    const coach = followups(d, NIGHT, t.end + 60_000, { name: 'Chris Alder', leader: false }).find((f) => f.id === 'p-pq')!;
    expect(coach.private).toBe(true);
    expect(coach.sub).not.toContain('surgery');
    const lead = followups(d, NIGHT, t.end + 60_000, leader).find((f) => f.id === 'p-pq')!;
    expect(lead.sub).toContain('surgery');
    expect(lead.mine).toBe(true);
  });
});

describe('serving', () => {
  it('finds a person’s crew name behind their title', () => {
    const d = fresh();
    expect(selfName(d, 'Coach Chris')).toBe('Chris Alder');
    expect(selfName(d, 'Pastor Mike')).toBe('Mike Torres');
  });

  it('lists the nights someone serves and the open spots', () => {
    const d = fresh();
    const nights = upcomingNights(d.config.meetingDates, NIGHT, 4);
    expect(myNights(d, 'Chris Alder', nights).map((n) => n.role)).toEqual(['Van driver', 'Game lead']);
    expect(openSpots(d, nights)).toHaveLength(3);
    expect(myNights(d, 'Marcus Hall', nights)[0].pending).toBe(true);
  });
});

describe('families', () => {
  it('resolve an audience to students', () => {
    const d = fresh();
    expect(audienceKids(d, 'unsigned:van')).toEqual(['Isaac Smith', 'Wyatt Price', 'Noah Godshall', 'Amelia Duff']);
    expect(audienceKids(d, 'Ellison Reid')).toEqual(['Ellison Reid']);
    expect(audienceKids(d, 'Nobody Here')).toEqual([]);
  });

  it('show a family only what reached their student, plus parent reminders', () => {
    const d = fresh();
    d.parentMsgs.push({ id: 'x', from: 'Pastor Mike', to: 'Isaac Smith', kids: ['Isaac Smith'], text: 'Just for Isaac', at: 1, reads: {} });
    const feed = familyFeed(d, 'Ellison Reid', NIGHT, atLocal(NIGHT, '08:00'));
    expect(feed.some((f) => f.text === 'Just for Isaac')).toBe(false);
    expect(feed.some((f) => f.kind === 'reminder')).toBe(true);
    expect(feed.filter((f) => f.kind === 'reminder').every((f) => !f.text.includes('Check your role'))).toBe(true);
  });
});

describe('what needs a leader', () => {
  it('raises swaps before the night and follow-ups after it', () => {
    const d = fresh();
    const t = nightTimes(d.config.cycle, NIGHT);
    const before = cycleNeeds(d, NIGHT, atLocal(NIGHT, '12:00'), leader).map((n) => n.id);
    expect(before).toContain('cy-swaps');
    expect(before).toContain('cy-slip-van');
    const after = cycleNeeds(d, NIGHT, t.end + 60_000, leader).map((n) => n.id);
    expect(after).toContain('cy-fu');
    expect(after).not.toContain('cy-slip-van');
  });
});

describe('self check-in', () => {
  it('opens before doors on the night and closes when it wraps', () => {
    const d = fresh();
    const kid = d.roster.find((r) => r.name === 'Ellison Reid');
    const t = nightTimes(d.config.cycle, NIGHT);
    expect(selfCheckin(d, kid, t.checkinOpen - 60_000).ok).toBe(false);
    expect(selfCheckin(d, kid, t.checkinOpen + 60_000).ok).toBe(true);
    expect(selfCheckin(d, kid, t.end + 60_000).ok).toBe(false);
    expect(selfCheckin(d, undefined, t.checkinOpen + 60_000).why).toContain('find a leader');
    d.tonight.presence['Ellison Reid'] = true;
    expect(selfCheckin(d, kid, t.checkinOpen + 60_000).why).toBe('You’re checked in.');
  });
});
