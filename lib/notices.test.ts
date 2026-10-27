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
