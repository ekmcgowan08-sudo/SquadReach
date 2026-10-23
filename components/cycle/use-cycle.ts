'use client';
/* What every night-cycle screen needs: the night, its times, the moment to
   read them at, and who is looking. Real time, always — except that demo
   mode can preview the week at another moment (the "Preview as of" chips),
   which only changes the `now` these screens are handed. */
import { emptyNight, history, nightOf, nightTimes, previewStages, upcomingNights, type NightTimes, type Viewer } from '@/lib/cycle';
import { servingName } from '@/lib/selectors';
import { isoDay, tonightDate } from '@/lib/dates';
import { hashStr } from '@/lib/data/seed';
import { canApprove } from '@/lib/permissions';
import { setPrefs, usePrefs } from '@/lib/prefs';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { NightCycle } from '@/lib/types/model';
import { useNow } from '@/lib/use-now';

export function useCycle() {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const prefs = usePrefs();
  const real = useNow(true, 30_000);
  const iso = d.tonight.date || tonightDate(d.config.meetingDates, new Date(real));
  const night = nightOf(d, iso);
  const t = nightTimes(d.config.cycle, iso, night.pickupShift);
  const stages = previewStages(t);
  const preview = m.mode === 'demo' ? (stages.find((s) => s.id === prefs.cyclePreview) ?? null) : null;
  const now = preview?.at ?? real;
  const me: Viewer = { name: servingName(d, m), leader: canApprove(m.persona) };
  const nights = upcomingNights(d.config.meetingDates, iso, 4);
  return { d, m, iso, night, t, now, stages, preview, me, nights, today: isoDay(new Date(now)) };
}

/** Change one night's state and keep the snapshot in step. */
export function useNightSave() {
  const api = useAppApi();
  return (iso: string, recipe: (n: NightCycle) => void) =>
    api().mutate((x) => {
      x.cycle ??= {};
      x.cycle[iso] = { ...emptyNight(), ...x.cycle[iso] };
      recipe(x.cycle[iso]);
    });
}

/** Demo only: move the preview clock. Passing the night seeds the check-ins a
 *  real night would have had, so the recap has something to recap. */
export function usePreviewPick() {
  const api = useAppApi();
  return (stageId: string | null, t: NightTimes) => {
    setPrefs({ cyclePreview: stageId });
    const at = previewStages(t).find((s) => s.id === stageId)?.at ?? 0;
    if (!stageId || at < t.setup) return;
    const d = api().data;
    if (Object.keys(d.tonight.presence).length) return;
    const iso = d.tonight.date;
    api().mutate((x) => {
      x.tonight.via ??= {};
      for (const s of x.roster) {
        if (s.guest) continue;
        const h = history(x, s.name, iso);
        const regular = h.filter(Boolean).length * 2 >= Math.max(1, h.length);
        if (hashStr(s.name + iso) % 100 < (regular ? 86 : 22)) {
          x.tonight.presence[s.name] = true;
          x.tonight.via[s.name] = hashStr('via' + s.name) % 3 ? 'qr' : 'leader';
        }
      }
      if (!x.roster.some((r) => r.name === 'Kai Bennett')) {
        x.roster.push({ id: uid(), name: 'Kai Bennett', team: 'yellow', grade: '8', guest: true, newInDb: true });
        x.families['Kai Bennett'] = { guardian: 'Rob Bennett', contact: '(417) 555-4410', token: 'demo-bennett' };
      }
      x.tonight.presence['Kai Bennett'] = true;
      x.tonight.via['Kai Bennett'] = 'leader';
      if (!x.prayerQueue.some((p) => p.id === 'demo-night-prayer'))
        x.prayerQueue.push({ id: 'demo-night-prayer', who: 'Harper Banning', meta: 'small group · Yellow', body: 'Her grandmother goes in for surgery Friday. She asked us not to share it with the room.', at: t.doors + 80 * 60_000 });
      for (const c of x.huddle.crew) x.huddle.crewState[c.id] ??= 'here';
    });
  };
}
