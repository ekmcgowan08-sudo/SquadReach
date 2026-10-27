import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GATES, type GateName } from '@/lib/gates';
import { MORE_GROUPS, MORE_ROWS, NESTED, PLANNER_NAV, ROUTES, moreRowShows, routeOf, tabBar, type MoreRowId, type Route } from '@/lib/screen-map';
import { PERSONAS } from '@/lib/types/domain';

const APP = path.resolve(__dirname, '..', 'app');
const SIGNED_IN = ['dashboard', 'console', 'planner', 'projector', 'live'];

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const full = path.join(dir, f);
    if (statSync(full).isDirectory()) return pages(full);
    return f === 'page.tsx' ? [full] : [];
  });
}

/** The gate named in a file's requireGate(), 'any' for a bare call, null for none. */
function gateIn(file: string): GateName | null {
  let src: string;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const hit = src.match(/requireGate\((?:GATES\.(\w+))?\)/);
  return hit ? ((hit[1] ?? 'any') as GateName) : null;
}

/** Every gate between the app root and this page: its layouts, then itself. */
function gatesFor(page: string): GateName[] {
  const out: GateName[] = [];
  let dir = path.dirname(page);
  while (dir.startsWith(APP) && dir !== APP) {
    const g = gateIn(path.join(dir, 'layout.tsx'));
    if (g) out.push(g);
    dir = path.dirname(dir);
  }
  const own = gateIn(page);
  if (own) out.push(own);
  return out;
}

const found = SIGNED_IN.flatMap((top) => pages(path.join(APP, top))).map((file) => {
  const route = '/' + path.relative(APP, path.dirname(file)).split(path.sep).join('/');
  const strict = [...new Set(gatesFor(file).filter((g) => g !== 'any'))];
  return { file, route, strict, client: readFileSync(file, 'utf8').match(/<Gate allow="(\w+)"/)?.[1] ?? null };
});

describe('the routes table', () => {
  it('has every signed-in page, gated the way the page itself is', () => {
    for (const f of found) {
      expect(ROUTES, f.route).toHaveProperty([f.route]);
      expect(f.strict.length, f.route + ' has more than one gate').toBeLessThanOrEqual(1);
      expect(ROUTES[f.route as Route], f.route).toBe(f.strict[0] ?? 'any');
    }
  });

  it('lists no route that has no page', () => {
    const real = new Set(found.map((f) => f.route));
    for (const r of Object.keys(ROUTES)) expect(real.has(r), r).toBe(true);
  });

  it('agrees with the client half of each gate', () => {
    for (const f of found) if (f.client) expect(f.client, f.route).toBe(ROUTES[f.route as Route]);
  });
});

describe('More', () => {
  const ids = Object.keys(MORE_ROWS) as MoreRowId[];

  it('puts every row in exactly one group', () => {
    const placed = MORE_GROUPS.flatMap((g) => g.rows);
    expect([...placed].sort()).toEqual([...ids].sort());
  });

  it('never shows a role a row whose screen would refuse it', () => {
    for (const id of ids) {
      const href = (MORE_ROWS[id] as { href?: string }).href;
      if (!href) continue;
      const route = routeOf(href) as Route;
      expect(ROUTES, id).toHaveProperty([route]);
      for (const { id: p } of PERSONAS)
        for (const demo of [true, false]) if (moreRowShows(id, p, demo)) expect(GATES[ROUTES[route]](p), id + ' for ' + p).toBe(true);
    }
  });

  it('shows Prayer & Care or the Prayer Wall, never both', () => {
    for (const { id: p } of PERSONAS) expect(moreRowShows('care', p) && moreRowShows('wall', p)).toBe(false);
    expect(moreRowShows('care', 'coach')).toBe(true);
    expect(moreRowShows('wall', 'member')).toBe(true);
    expect(moreRowShows('wall', 'parent')).toBe(false);
  });

  it('keeps demo rows to the demo and sign-out to a real ministry', () => {
    expect(moreRowShows('reset', 'leader', true)).toBe(true);
    expect(moreRowShows('reset', 'leader', false)).toBe(false);
    expect(moreRowShows('signOut', 'leader', true)).toBe(false);
    expect(moreRowShows('signOut', 'leader', false)).toBe(true);
  });

  it('withholds Submit Points from a team member, who cannot submit', () => {
    expect(moreRowShows('submit', 'member')).toBe(false);
    expect(moreRowShows('submit', 'captain')).toBe(true);
  });
});

describe('the tab bar', () => {
  it('opens only screens the role can hold', () => {
    for (const { id: p } of PERSONAS) for (const t of tabBar(p)) expect(GATES[ROUTES[routeOf(t.href) as Route]](p), t.href + ' for ' + p).toBe(true);
  });

  it('gives Score to those who score and the Bible to everyone else', () => {
    expect(tabBar('coach')[2].label).toBe('Score');
    expect(tabBar('member')[2].label).toBe('Bible');
  });
});

describe('the map', () => {
  it('reaches every route from a tab, a More row, the desk or another screen', () => {
    const reached = new Set<string>([
      ...PERSONAS.flatMap(({ id }) => tabBar(id).map((t) => routeOf(t.href))),
      ...Object.values(MORE_ROWS).flatMap((r) => ('href' in r ? [routeOf(r.href)] : [])),
      ...PLANNER_NAV.map((n) => n.href),
      ...NESTED.flatMap((n) => (n.href ? [n.href] : []))
    ]);
    for (const r of Object.keys(ROUTES)) expect(reached.has(r), r).toBe(true);
  });
});
