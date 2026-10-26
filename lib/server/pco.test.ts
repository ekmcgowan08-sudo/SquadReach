import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authorizeUrl, connect, pcoCheckIns, pcoPeople, type PcoDeps } from '@/lib/server/pco';

type Row = Record<string, unknown>;
const NOW = Date.UTC(2026, 9, 28, 23, 0);

/* The one table the client touches, as supabase-js would. */
function fakeDb(rows: Row[]) {
  const q = () => {
    let where: [string, unknown] | null = null;
    let patch: Row | null = null;
    const hit = () => rows.filter((r) => !where || r[where[0]] === where[1]);
    const b = {
      select: () => b,
      eq: (c: string, v: unknown) => ((where = [c, v]), b),
      maybeSingle: async () => ({ data: hit()[0] ?? null, error: null }),
      update: (p: Row) => ((patch = p), b),
      delete: () => b,
      upsert: async (row: Row) => {
        const i = rows.findIndex((r) => r.org_id === row.org_id);
        if (i >= 0) rows[i] = row;
        else rows.push(row);
        return { error: null };
      },
      then: (ok: (v: unknown) => unknown) => {
        if (patch) for (const r of hit()) Object.assign(r, patch);
        return Promise.resolve({ error: null }).then(ok);
      }
    };
    return b;
  };
  return { from: q } as unknown as SupabaseClient;
}

/* A stand-in for api.planningcenteronline.com. */
function fakePco(opts: { reject401Once?: boolean } = {}) {
  const calls: string[] = [];
  let rejected = false;
  let issued = 0;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const f = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const auth = new Headers(init?.headers).get('Authorization') ?? '';
    calls.push((init?.method ?? 'GET') + ' ' + url.replace('https://api.planningcenteronline.com', '') + (auth ? ' [' + auth.slice(7) + ']' : ''));
    if (url.endsWith('/oauth/token')) {
      const body = JSON.parse(String(init?.body)) as Record<string, string>;
      if (body.client_secret !== 'shh') return json({ error: 'invalid_client' }, 401);
      issued++;
      return json({ access_token: 'tok' + issued, refresh_token: 'ref' + issued, expires_in: 7200, scope: 'people check_ins', token_type: 'bearer' });
    }
    if (opts.reject401Once && !rejected && url.includes('/people/v2/people')) {
      rejected = true;
      return json({ errors: [{ status: '401' }] }, 401);
    }
    if (url.endsWith('/people/v2')) return json({ data: { type: 'Organization', id: '1', attributes: { name: 'Grace Church' } } });
    if (url.includes('/people/v2/people?') && !url.includes('offset=')) {
      return json({ data: [{ id: '1', type: 'Person', attributes: { first_name: 'Ellison', last_name: 'Reid', grade: 8, child: true, status: 'active' } }], links: { next: 'https://api.planningcenteronline.com/people/v2/people?per_page=100&offset=100' } });
    }
    if (url.includes('offset=100')) return json({ data: [{ id: '2', type: 'Person', attributes: { first_name: 'Isaac', last_name: 'Smith', grade: 9, child: true, status: 'active' } }] });
    if (url.includes('/check-ins/v2/check_ins')) {
      const at = (h: number) => new Date(NOW - h * 3600_000).toISOString();
      if (!url.includes('offset')) {
        return json({
          data: [
            { id: 'a', type: 'CheckIn', attributes: { first_name: 'Ellison', last_name: 'Reid', kind: 'Regular', created_at: at(0.5) } },
            { id: 'b', type: 'CheckIn', attributes: { first_name: 'Coach', last_name: 'Kyle', kind: 'Volunteer', created_at: at(1) } }
          ],
          links: { next: 'https://api.planningcenteronline.com/check-ins/v2/check_ins?offset=2' }
        });
      }
      return json({
        data: [
          { id: 'c', type: 'CheckIn', attributes: { first_name: 'Isaac', last_name: 'Smith', kind: 'Guest', created_at: at(2) } },
          { id: 'd', type: 'CheckIn', attributes: { first_name: 'Last', last_name: 'Week', kind: 'Regular', created_at: at(170) } }
        ],
        links: { next: 'https://api.planningcenteronline.com/check-ins/v2/check_ins?offset=4' }
      });
    }
    return json({ errors: [{ status: '404' }] }, 404);
  }) as typeof fetch;
  return { f, calls };
}

const deps = (f: typeof fetch, rows: Row[]): PcoDeps => ({ fetch: f, db: fakeDb(rows), now: () => NOW, clientId: 'app', clientSecret: 'shh' });

describe('Planning Center on the server', () => {
  it('sends the leader to Planning Center with the right scopes', () => {
    const u = new URL(authorizeUrl('app', 'https://squadrise.test/api/pco/callback', 'st8'));
    expect(u.origin + u.pathname).toBe('https://api.planningcenteronline.com/oauth/authorize');
    expect(Object.fromEntries(u.searchParams)).toEqual({ client_id: 'app', redirect_uri: 'https://squadrise.test/api/pco/callback', response_type: 'code', scope: 'people check_ins', state: 'st8' });
  });

  it('connects: trades the code, names the organization, keeps the tokens', async () => {
    const rows: Row[] = [];
    const { f } = fakePco();
    expect(await connect(deps(f, rows), 'org-1', 'code123', 'https://x/cb', 'u1')).toEqual({ org: 'Grace Church' });
    expect(rows[0]).toMatchObject({ org_id: 'org-1', access_token: 'tok1', refresh_token: 'ref1', pco_org_name: 'Grace Church', connected_by: 'u1' });
    expect(Date.parse(String(rows[0].expires_at))).toBe(NOW + 7200_000);
  });

  it('refreshes a token that has run out before reading, and reads every page', async () => {
    const rows: Row[] = [{ org_id: 'org-1', access_token: 'old', refresh_token: 'r0', expires_at: new Date(NOW - 1000).toISOString() }];
    const { f, calls } = fakePco();
    const people = await pcoPeople(deps(f, rows), 'org-1');
    expect(people.map((p) => p.name)).toEqual(['Ellison Reid', 'Isaac Smith']);
    expect(calls[0]).toBe('POST /oauth/token');
    expect(calls.slice(1).every((c) => c.endsWith('[tok1]'))).toBe(true);
    expect(rows[0]).toMatchObject({ access_token: 'tok1', refresh_token: 'ref1' });
  });

  it('tries once more with a fresh token when Planning Center turns one down', async () => {
    const rows: Row[] = [{ org_id: 'org-1', access_token: 'live', refresh_token: 'r0', expires_at: new Date(NOW + 3600_000).toISOString() }];
    const { f, calls } = fakePco({ reject401Once: true });
    const people = await pcoPeople(deps(f, rows), 'org-1');
    expect(people).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith('POST /oauth/token'))).toHaveLength(1);
  });

  it('says so when the ministry never connected', async () => {
    const { f } = fakePco();
    await expect(pcoPeople(deps(f, []), 'org-1')).rejects.toThrow('isn’t connected');
  });

  it('reads tonight’s check-ins newest first, and stops once it passes the start of the night', async () => {
    const rows: Row[] = [{ org_id: 'org-1', access_token: 'live', refresh_token: 'r0', expires_at: new Date(NOW + 3600_000).toISOString() }];
    const { f, calls } = fakePco();
    const names = await pcoCheckIns(deps(f, rows), 'org-1', new Date(NOW - 6 * 3600_000).toISOString(), new Date(NOW + 3600_000).toISOString());
    expect(names).toEqual(['Ellison Reid', 'Isaac Smith']);
    expect(calls.filter((c) => c.includes('check_ins'))).toHaveLength(2);
  });
});
