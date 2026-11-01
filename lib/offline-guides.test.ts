import { describe, expect, it } from 'vitest';
import { offlineCopy } from '@/lib/offline-guides';
import type { SmallGroup } from '@/lib/types/model';

const guide: SmallGroup = {
  id: 'sg1',
  title: 'Who is my neighbor?',
  notes: 'After the relay.',
  weekNumber: 9,
  screens: [
    { id: 'a', type: 'scripture', title: 'Read it', body: 'Love your neighbor as yourself.', ref: 'Mark 12:31', image: { src: null, bankId: 'worship-hands', layer: 'above', posX: 50, posY: 50, scale: 100, opacity: 100 } },
    { id: 'b', type: 'timer', title: 'Two minutes', body: '', timerSeconds: 120, image: { src: 'data:image/jpeg;base64,AAAA', bankId: null, layer: 'behind', posX: 20, posY: 80, scale: 110, opacity: 40 } },
    { id: 'c', type: 'nonsense', title: 'Odd one', body: '' }
  ]
};

describe('a guide saved for no signal', () => {
  it('carries everything the offline page needs to play it', () => {
    const c = offlineCopy(guide, 'org-1', 'Grace Community Students', 1000);
    expect(c).toMatchObject({ key: 'org-1:sg1', org: 'org-1', ministry: 'Grace Community Students', title: 'Who is my neighbor?', weekNumber: 9, savedAt: 1000 });
    expect(c.minutes).toBe(Math.round((120 + 120 + 90) / 60));
    expect(c.screens[0].look).toEqual({ label: 'Scripture', color: '#4f9fd6', bg: 'radial-gradient(circle at 30% 20%, #16283a, #17181f)' });
    expect(c.screens[0].tile).toEqual({ label: 'Worship night', color: '#5a3a8f' });
    expect(c.screens[0].ref).toBe('Mark 12:31');
  });

  it('keeps a photo as it is, and gives an unknown kind of screen a look anyway', () => {
    const c = offlineCopy(guide, 'demo', 'Grace', 0);
    expect(c.screens[1].tile).toBeNull();
    expect(c.screens[1].image?.src).toBe('data:image/jpeg;base64,AAAA');
    expect(c.screens[2].look.label).toBe('Fun thought');
  });
});
