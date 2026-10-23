import { describe, expect, it } from 'vitest';
import { demoMinistry } from '@/lib/data/seed';
import {
  attendanceRows, availableBench, bracketSeeds, bracketWinPayable, buildBracket, churchRows, churchSocials,
  creditChallenges, nextBracketGame, settleFromClip, uncoveredPosts, type BracketState
} from '@/lib/feeds';

const d = demoMinistry(0);
const bracket = (p: Partial<BracketState> = {}): BracketState => ({ enabled: true, seeds: [], winners: {}, liveSeed: true, paid: {}, ...p });

describe('standings → bracket seeding', () => {
  it('seeds follow the live standings until a result is entered', () => {
    expect(bracketSeeds(d.teams, d.ledger, bracket())).toEqual(['yellow', 'red', 'blue', 'green']);
  });
  it('a manual seed sticks once live seeding is off', () => {
    const seeds = ['green', 'blue', 'red', 'yellow'];
    expect(bracketSeeds(d.teams, d.ledger, bracket({ liveSeed: false, seeds }))).toEqual(seeds);
  });
  it('a bye advances on its own', () => {
    const rounds = buildBracket(['a', 'b', 'c'], {});
    expect(rounds[0][1]).toMatchObject({ a: 'c', b: null });
    expect(rounds[1][0].b).toBe('c');
  });
});

describe('filming → bracket + points', () => {
  it('the squad with more game points wins the bracket game being played', () => {
    const b = bracket();
    const next = nextBracketGame(d.teams, d.ledger, b)!;
    expect(next.label).toBe('Semifinal');
    const { a, b: bb } = next.match;
    expect(settleFromClip(d.teams, d.ledger, b, [a!, bb!], { [a!]: 3, [bb!]: 5 })).toEqual({ matchKey: next.match.key, winner: bb });
  });
  it('a level game or the wrong two squads settles nothing', () => {
    const b = bracket();
    const { a, b: bb } = nextBracketGame(d.teams, d.ledger, b)!.match;
    expect(settleFromClip(d.teams, d.ledger, b, [a!, bb!], { [a!]: 2, [bb!]: 2 })).toBeNull();
    expect(settleFromClip(d.teams, d.ledger, b, ['red', 'blue'], { red: 1, blue: 0 })).toBeNull();
  });
  it('a win pays once; a correction to a different winner pays that winner', () => {
    const b = bracket({ paid: { '0-0': 'yellow' } });
    expect(bracketWinPayable(b, '0-0', 'yellow')).toBe(false);
    expect(bracketWinPayable(b, '0-0', 'green')).toBe(true);
  });
});

describe('attendance → tonight’s points', () => {
  it('pays every present student in General plus each auto category', () => {
    const presence = { 'Ellison Reid': true, 'Luke Jarvis': true, 'Isaac Smith': true };
    const rows = attendanceRows(d.roster, 'yellow', presence, d.cats, { visitors: true });
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.amount === 50)).toBe(true);
    expect(new Set(rows.map((r) => r.cat))).toEqual(new Set(['general', 'visitors']));
  });
});

describe('small group → challenge credit', () => {
  it('credits each eligible challenge once and is idempotent', () => {
    const once = creditChallenges(d.challenges, {}, 'Ellison Reid', 'yellow')!;
    expect(Object.keys(once).sort()).toEqual(['c2', 'c3']);
    expect(creditChallenges(d.challenges, once, 'Ellison Reid', 'yellow')).toBeNull();
  });
});

describe('church card', () => {
  it('blank fields disappear and handles become links', () => {
    expect(churchRows({ ...d.config.church, phone: '  ' }).map((r) => r.label)).not.toContain('Call');
    const socials = churchSocials(d.config.church);
    expect(socials.find((s) => s.label === 'Instagram')!.href).toBe('https://instagram.com/gracestudents');
    expect(socials.find((s) => s.label === 'TikTok')).toBeUndefined();
  });
});

describe('huddle: uncovered posts are computed', () => {
  it('a volunteer marked out opens their post, plus the never-filled ones', () => {
    const posts = uncoveredPosts(d.huddle);
    expect(posts.map((p) => p.post)).toEqual(['Gym floor · roaming', 'South door · greeter']);
  });
  it('covering a post removes it and takes that volunteer off the bench', () => {
    const h = { ...d.huddle, covered: { 'crew:c5': 'b1' } };
    expect(uncoveredPosts(h).map((p) => p.id)).toEqual(['op1']);
    expect(availableBench(h).map((b) => b.id)).not.toContain('b1');
  });
});
