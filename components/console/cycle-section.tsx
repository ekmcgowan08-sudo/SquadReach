'use client';
/* Console · Setup · The week around the night: the night's times, pickup,
   how long follow-ups have, who serves, and the four reminders' timing and
   words. The phone's Prep week, Recap, Serving and Parents screens read
   exactly this. */
import { Field, Section, useSaveConfig } from '@/components/console/kit';
import { Btn } from '@/components/ui';
import { DEFAULT_REMINDERS } from '@/lib/cycle';
import { useApp } from '@/lib/store/provider';
import type { CycleConfig, ReminderDef } from '@/lib/types/model';

const hhmm = (v: string) => (/^\d{1,2}:\d{2}$/.test(v.trim()) ? v.trim().padStart(5, '0') : null);

export function CycleSection() {
  const c = useApp((s) => s.data.config.cycle);
  const save = useSaveConfig();
  const set = (patch: Partial<CycleConfig>, note?: string) => save((cfg) => ({ cycle: { ...cfg.cycle, ...patch } }), note);
  const setRem = (id: string, patch: Partial<ReminderDef>) => set({ reminders: c.reminders.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  return (
    <Section title="The week around the night" sub="Times for the night itself, pickup, follow-ups, who serves, and the reminders that go out before it. Reminders post to leaders’ notifications and each family’s link.">
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Setup (crew arrives)" type="time" value={c.setupAt} onSave={(v) => hhmm(v) && set({ setupAt: hhmm(v)! })} />
        <Field label="Doors" type="time" value={c.doorsAt} onSave={(v) => hhmm(v) && set({ doorsAt: hhmm(v)! })} />
        <Field label="Pickup" type="time" value={c.pickupAt} onSave={(v) => hhmm(v) && set({ pickupAt: hhmm(v)! })} />
        <Field label="Night wraps" type="time" value={c.endAt} onSave={(v) => hhmm(v) && set({ endAt: hhmm(v)! })} />
        <Field label="Pickup place" value={c.pickupPlace} onSave={(v) => set({ pickupPlace: v.trim() || 'front doors' })} />
        <Field label="Follow-ups due (hours after)" type="number" value={c.followupHours} onSave={(v) => set({ followupHours: Math.max(1, Math.min(168, Number(v) || 48)) })} />
        <Field label="Self check-in opens (min before doors)" type="number" value={c.checkinOpensMin} onSave={(v) => set({ checkinOpensMin: Math.max(0, Math.min(180, Number(v) || 0)) })} />
      </div>
      <Field
        label="Serving roles (comma separated)"
        value={c.serveRoles.join(', ')}
        onSave={(v) => set({ serveRoles: [...new Set(v.split(',').map((x) => x.trim()).filter(Boolean))] }, 'Changed the serving roles')}
        hint="The volunteer schedule has one spot per role per night."
      />
      <div className="flex flex-col gap-3">
        {c.reminders.map((r) => (
          <div key={r.id} className="grid gap-2 rounded-md border border-neutral-800 p-3 sm:grid-cols-[1fr_120px_110px_110px]">
            <Field label="Reminder" value={r.label} onSave={(v) => setRem(r.id, { label: v.trim() || r.label })} />
            {r.beforeMin > 0 ? (
              <Field label="Minutes before setup" type="number" value={r.beforeMin} onSave={(v) => setRem(r.id, { beforeMin: Math.max(5, Number(v) || r.beforeMin) })} />
            ) : (
              <>
                <Field label="Days before" type="number" value={r.days} onSave={(v) => setRem(r.id, { days: Math.max(0, Math.min(14, Number(v) || 0)) })} />
                <Field label="At" type="time" value={r.time} onSave={(v) => hhmm(v) && setRem(r.id, { time: hhmm(v)! })} />
              </>
            )}
            <label className="field">
              <span className="sr-label">Goes to</span>
              <select
                className="input"
                value={r.aud.join('+')}
                onChange={(e) => setRem(r.id, { aud: e.target.value.split('+') as ReminderDef['aud'] })}
              >
                <option value="leaders">Leaders</option>
                <option value="parents">Parents</option>
                <option value="leaders+parents">Both</option>
              </select>
            </label>
            <div className="sm:col-span-4">
              <Field label="Words" value={r.text} onSave={(v) => setRem(r.id, { text: v.trim() || r.text })} hint="Fills in: {day} {week} {game} {setup} {doors} {pickup} {place} {ministry}" />
            </div>
          </div>
        ))}
        <Btn variant="ghost" className="self-start px-3 text-neutral-400" onClick={() => window.confirm('Put the four reminders back to their original timing and words?') && set({ reminders: DEFAULT_REMINDERS }, 'Reset the prep reminders')}>
          Reset reminders
        </Btn>
      </div>
    </Section>
  );
}
