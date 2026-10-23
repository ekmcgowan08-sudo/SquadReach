'use client';
/* PLANNER · PREP & RECAP — the week before the night beside the night
   after it. The same screens the phone uses, side by side. */
import { PageHead } from '@/components/planner/kit';
import { useCycle } from '@/components/cycle/use-cycle';
import { NightRecapScreen } from '@/components/screens/night-recap';
import { PrepWeekScreen } from '@/components/screens/prep-week';
import { dayLabel, dueLine, isAfter } from '@/lib/cycle';

export function PrepRecap() {
  const { t, now } = useCycle();
  return (
    <>
      <PageHead kicker="The week around the night" title="Prep & recap" sub={'Prep for ' + dayLabel(t.setup) + (isAfter(t, now) ? ' · ' + dueLine(t, now) : '') + '. Changes here show on every phone within a second.'} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="sr-card overflow-hidden pt-2">
          <PrepWeekScreen bare />
        </div>
        <div className="sr-card overflow-hidden pt-2">
          <NightRecapScreen bare />
        </div>
      </div>
    </>
  );
}
