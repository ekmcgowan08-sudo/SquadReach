import { describe, expect, it } from 'vitest';
import { notifOn } from '@/lib/prefs';

describe('which notifications reach a person', () => {
  it('follows the ministry default unless they chose for themselves', () => {
    const on = notifOn({ weeklySummary: false, prayer: false }, { prayer: true });
    expect(on.weeklySummary).toBe(false);
    expect(on.prayer).toBe(true);
    expect(on.event).toBe(true);
  });
  it('is all on with no defaults and no choices', () => {
    expect(Object.values(notifOn(undefined, {})).every(Boolean)).toBe(true);
  });
});
