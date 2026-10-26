import { describe, expect, it } from 'vitest';
import { EXAMPLE_MINISTRY, PRICING_MODELS, RECOMMENDED_MODEL, annualFor, isVendorEmail, planFor } from '@/lib/pricing';

describe('pricing models', () => {
  it('match the handoff at 96 students, 14 leaders, 2 seasons', () => {
    const c = EXAMPLE_MINISTRY;
    expect(annualFor('band', c)).toBe(699);
    expect(annualFor('perStudent', c)).toBe(864);
    expect(annualFor('perSeason', c)).toBe(558);
    expect(annualFor('perLeader', c)).toBe(1008);
    expect(RECOMMENDED_MODEL).toBe('band');
  });

  it('band edges land where they say', () => {
    const at = (students: number) => annualFor('band', { students, leaders: 1, seasons: 1 });
    expect([at(50), at(51), at(150), at(151), at(400), at(401)]).toEqual([399, 699, 699, 1199, 1199, 1899]);
    expect([planFor(50), planFor(51), planFor(150), planFor(151)]).toEqual(['starter', 'ministry', 'ministry', 'network']);
  });

  it('per student keeps its 25-student minimum', () => {
    expect(annualFor('perStudent', { students: 8, leaders: 1, seasons: 1 })).toBe(225);
  });

  it('each says how it got its number', () => {
    expect(PRICING_MODELS.map((m) => m.detail(EXAMPLE_MINISTRY))).toEqual(['up to 150 students', '96 × $9', '2 × $279', '14 seats × $6 × 12']);
  });
});

describe('who may see pricing', () => {
  it('only an email on the vendor list, whatever its case or spacing', () => {
    const env = ' founder@example.org, Partner@Example.org ,not-an-email';
    expect(isVendorEmail('founder@example.org', env)).toBe(true);
    expect(isVendorEmail('partner@example.org ', env)).toBe(true);
    expect(isVendorEmail('pastor@example.org', env)).toBe(false);
    expect(isVendorEmail('not-an-email', env)).toBe(false);
    expect(isVendorEmail(null, env)).toBe(false);
    expect(isVendorEmail('founder@example.org', undefined)).toBe(false);
    expect(isVendorEmail('founder@example.org', '')).toBe(false);
  });
});
