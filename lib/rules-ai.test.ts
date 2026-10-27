import { describe, expect, it } from 'vitest';
import { cleanRules, rulesBrief, type RawRules } from '@/lib/rules-ai';

const raw = (over: Partial<RawRules> = {}): RawRules => ({
  title: 'Sock wars',
  rules: 'Each squad starts behind its line.\n\n\n\nHit someone below the shoulders and they sit out.',
  format: { segment: 'rounds', count: 3, minutes: 4, ends: 'clock', scoring: 'goals', to_win: null, max_players: 8 },
  ...over
});

describe('drafting game rules', () => {
  it('briefs with the game and the notes', () => {
    expect(rulesBrief('throw socks', 'Sock wars')).toContain('Game: Sock wars');
  });
  it('keeps plain rules and a sane format', () => {
    const d = cleanRules(raw())!;
    expect(d.rules).toBe('Each squad starts behind its line.\n\nHit someone below the shoulders and they sit out.');
    expect(d.format).toMatchObject({ segment: 'rounds', count: 3, minutes: 4, maxPlayers: 8, toWin: null });
  });
  it('drops a draft with a quotation or markdown', () => {
    expect(cleanRules(raw({ rules: 'As the coach said, “everybody plays and everybody sits out once”.' }))).toBeNull();
    expect(cleanRules(raw({ rules: '# Rules\n**Start** here' }))).toBeNull();
  });
});
