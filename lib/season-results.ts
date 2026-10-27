/* Where a season finished: the top squad, the top scorer and how many
   students it reached, as of the day it's recorded. */
import { standings, studentRanks } from '@/lib/scoring';
import type { MinistryData, SeasonResult } from '@/lib/types/model';

export function seasonResult(d: MinistryData, ended: string): SeasonResult {
  const top = standings(d.teams, d.cats, d.ledger)[0];
  const scorer = studentRanks(d.roster.filter((r) => !r.guest), d.ledger, d.studentSeedPoints)[0];
  return {
    name: d.config.seasonName || 'Season',
    ended,
    champion: top?.name ?? '—',
    championPts: top?.total ?? 0,
    topScorer: scorer && scorer.total > 0 ? scorer.name : null,
    topPts: scorer?.total ?? 0,
    students: d.roster.filter((r) => !r.guest).length
  };
}

/** Keep one record per season name, newest first. */
export const withResult = (list: SeasonResult[] | undefined, r: SeasonResult) => [r, ...(list ?? []).filter((x) => x.name !== r.name)];
