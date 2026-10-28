import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import { computeNotifications } from '@/lib/selectors';
import type { Membership } from '@/lib/types/model';

const person = (displayName: string, persona: Membership['persona'] = 'coach'): Membership => ({
  mode: 'supabase', persona, role: null, displayName, firstName: displayName.split(' ')[0], initials: 'X', membershipId: 'm', orgId: 'o', teamId: null, studentName: null
});

describe('asked from the huddle to cover a post', () => {
  it('reaches the person asked, until the post is covered', () => {
    const d = demoMinistry();
    d.huddle.openPosts = [{ id: 'p1', post: 'North door', why: 'Nobody signed up' }];
    d.huddle.subAsks = { p1: ['b2'] };
    const kara = computeNotifications(d, person('Kara Judd')).filter((n) => n.href === '/dashboard/huddle' && n.icon === 'ph ph-hand-waving');
    expect(kara.map((n) => n.label)).toEqual(['Can you cover North door tonight?']);
    expect(computeNotifications(d, person('Luis Ferrer')).some((n) => n.label.startsWith('Can you cover'))).toBe(false);
    d.huddle.covered = { p1: 'b1' };
    expect(computeNotifications(d, person('Kara Judd')).some((n) => n.label.startsWith('Can you cover'))).toBe(false);
  });
});

describe('a captain’s nudge', () => {
  const nudged = () => {
    const d = demoMinistry();
    d.nudges = [
      { id: 'n1', date: d.tonight.date, student: 'Ellison Reid', kind: 'push', by: 'Luke Jarvis', at: 0 },
      { id: 'n2', date: d.tonight.date, student: 'Ellison Reid', kind: 'home', by: 'Luke Jarvis', at: 0 }
    ];
    return d;
  };
  const student = { ...person('Ellison Reid', 'member'), studentName: 'Ellison Reid' };

  it('tells the student their squad is looking for them, and only them', () => {
    const d = nudged();
    expect(computeNotifications(d, student).filter((n) => n.trigger === 'nudge').map((n) => n.label + ' · ' + n.meta)).toEqual(['Your squad is looking for you · Luke checked — are you coming tonight?']);
    expect(computeNotifications(d, { ...student, displayName: 'Rory Banks', studentName: 'Rory Banks' }).some((n) => n.trigger === 'nudge')).toBe(false);
  });

  it('asks a leader — never the student — to text home, opening the family’s card', () => {
    const d = nudged();
    const home = (m: Membership) => computeNotifications(d, m).filter((n) => n.label.endsWith('household?'));
    expect(home(person('Pastor Mike', 'leader')).map((n) => n.href)).toEqual(['/dashboard/parents?family=Ellison%20Reid']);
    expect(home(student)).toEqual([]);
    expect(home(person('Coach Chris'))).toEqual([]);
  });

  it('goes quiet once they’re here, and on another night', () => {
    const d = nudged();
    d.tonight.presence['Ellison Reid'] = true;
    expect(computeNotifications(d, student).some((n) => n.trigger === 'nudge')).toBe(false);
    const e = nudged();
    e.nudges = e.nudges.map((n) => ({ ...n, date: '2026-10-21' }));
    expect(computeNotifications(e, person('Pastor Mike', 'leader')).some((n) => n.label.endsWith('household?'))).toBe(false);
  });
});
