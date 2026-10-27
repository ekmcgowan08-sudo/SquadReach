import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import { computeNotifications, openChatFlags } from '@/lib/selectors';
import type { Membership } from '@/lib/types/model';

const who = (persona: Membership['persona']): Membership => ({ mode: 'demo', persona, role: null, displayName: 'Someone', firstName: 'Someone', initials: 'S', membershipId: null, orgId: null, teamId: null, studentName: null });

describe('a flagged chat thread', () => {
  const d = demoMinistry();
  d.chatFlags = [
    { id: 'f1', thread: 'team-blue', threadName: 'Blue Squad', by: 'Zoe Gillespie', at: 1 },
    { id: 'f2', thread: 'leaders', threadName: 'Leaders & coaches', by: 'Carla Sandoval', at: 2, seenBy: 'Pastor Mike', seenAt: 3 }
  ];

  it('stays open until a leader reads it', () => {
    expect(openChatFlags(d).map((f) => f.id)).toEqual(['f1']);
    expect(openChatFlags(d, 'leaders')).toEqual([]);
  });

  it('tells leaders, and nobody else, linking to the thread', () => {
    const lead = computeNotifications(d, who('leader')).filter((n) => n.trigger === 'chatFlag');
    expect(lead).toEqual([expect.objectContaining({ label: 'Zoe Gillespie flagged the Blue Squad thread', href: '/dashboard/chat?t=team-blue' })]);
    expect(computeNotifications(d, who('coach')).some((n) => n.trigger === 'chatFlag')).toBe(false);
    expect(computeNotifications(d, who('leader'), { chatFlag: false }).some((n) => n.trigger === 'chatFlag')).toBe(false);
  });
});
