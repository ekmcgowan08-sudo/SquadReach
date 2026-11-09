/* Templates another ministry exported (Console › Home › Export the
   templates), read back in. Each comes in under a new id, beside what's
   already here — nothing of ours is replaced. Night outlines are dated to
   the other ministry's calendar, so they stay out. */
import type { SavedSeason } from '@/lib/season';
import { DEFAULT_EVENT_TYPES, type EventType, type GameTemplate, type MinistryConfig, type SmallGroupTemplate } from '@/lib/types/model';

export interface TemplateImport {
  config: Pick<MinistryConfig, 'gameTemplates' | 'sgTemplates' | 'eventTypes'>;
  seasons: SavedSeason[];
  counts: { games: number; smallgroups: number; events: number; seasons: number; nights: number };
}

const list = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** A name not already taken here: "Nerf night", then "Nerf night (imported)". */
function fresh(name: string, taken: Set<string>) {
  let n = name || 'Untitled';
  if (taken.has(n)) n += ' (imported)';
  for (let i = 2; taken.has(n); i++) n = name + ' (imported ' + i + ')';
  taken.add(n);
  return n;
}

/** Null when the file isn't a SquadRise template export. */
export function readTemplates(raw: unknown, cfg: MinistryConfig, seasons: SavedSeason[], newId: () => string, now: number): TemplateImport | null {
  const body = raw as { app?: unknown; kind?: unknown; folders?: Record<string, unknown> } | null;
  if (!body || body.app !== 'SquadRise' || body.kind !== 'templates' || !body.folders || typeof body.folders !== 'object') return null;
  const f = body.folders;

  const gameNames = new Set((cfg.gameTemplates ?? []).map((g) => g.name));
  const games: GameTemplate[] = list(f.games)
    .filter((g) => g.setup && typeof g.setup === 'object')
    .map((g) => ({ id: newId(), name: fresh(str(g.name), gameNames), setup: g.setup as GameTemplate['setup'] }));

  const sgNames = new Set((cfg.sgTemplates ?? []).map((t) => t.title));
  const groups: SmallGroupTemplate[] = list(f.smallgroups)
    .filter((t) => Array.isArray(t.screens))
    .map((t) => ({ id: newId(), title: fresh(str(t.title), sgNames), notes: str(t.notes), screens: (t.screens as SmallGroupTemplate['screens']).map((s) => ({ ...s, id: newId() })) }));

  const ours = cfg.eventTypes ?? DEFAULT_EVENT_TYPES;
  const eventNames = new Set(ours.map((e) => e.title));
  const events: EventType[] = list(f.events)
    .filter((e) => str(e.title) && !eventNames.has(str(e.title)))
    .map((e) => ({ ...(e as unknown as EventType), id: newId(), title: fresh(str(e.title), eventNames) }));

  const seasonNames = new Set(seasons.map((s) => s.name));
  const builds: SavedSeason[] = list(f.seasons)
    .filter((s) => s.answers && typeof s.answers === 'object')
    .map((s) => {
      const name = fresh(str(s.name) || 'Imported season', seasonNames);
      return { id: newId(), name, answers: { ...(s.answers as SavedSeason['answers']), name }, active: false, savedAt: now };
    });

  return {
    config: {
      gameTemplates: [...(cfg.gameTemplates ?? []), ...games],
      sgTemplates: [...(cfg.sgTemplates ?? []), ...groups],
      eventTypes: events.length ? [...ours, ...events] : cfg.eventTypes
    },
    seasons: [...seasons, ...builds],
    counts: { games: games.length, smallgroups: groups.length, events: events.length, seasons: builds.length, nights: list(f.nights).length }
  };
}

/** "2 games, 1 small group and 3 season builds" */
export function importLine(c: TemplateImport['counts']): string {
  const bits = [
    c.games && c.games + (c.games === 1 ? ' game' : ' games'),
    c.smallgroups && c.smallgroups + (c.smallgroups === 1 ? ' small group' : ' small groups'),
    c.events && c.events + (c.events === 1 ? ' event type' : ' event types'),
    c.seasons && c.seasons + (c.seasons === 1 ? ' season build' : ' season builds')
  ].filter(Boolean) as string[];
  return bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] : bits[0] ?? '';
}
