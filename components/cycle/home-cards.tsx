'use client';
/* The night cycle's two Home cards: the parent's Tonight card, and the
   student's door check-in while it is open. */
import { FamilyTonightCard } from '@/components/cycle/family-card';
import { useCycle } from '@/components/cycle/use-cycle';
import { Btn, Icon } from '@/components/ui';
import { checkinOpen, clock, familyView, selfCheckin } from '@/lib/cycle';
import { nowMs } from '@/lib/dates';
import { useAppApi } from '@/lib/store/provider';

/** Demo: the parent persona's phone. Real families use their private link. */
export function ParentTonight() {
  const { d, m, now } = useCycle();
  const api = useAppApi();
  const kid = m.studentName;
  const v = kid ? familyView(d, kid, now) : null;
  if (!v || !kid) return null;
  return (
    <FamilyTonightCard
      v={v}
      onSign={(slip) => {
        const by = v.guardian || m.displayName;
        api().mutate((x) => void (x.slipSigned[slip + '|' + kid] = { by, at: nowMs() }));
        api().emit({ kind: 'slipSign', slip, student: kid, by });
        api().say('Slip signed. The leaders can see it now.');
      }}
      onRead={(id) => api().mutate((x) => void x.parentMsgs.forEach((msg) => msg.id === id && (msg.reads[kid] = nowMs())))}
    />
  );
}

/** A student's "I'm here" — only on a meeting night, only while the door is open. */
export function CheckInCard() {
  const { d, m, t, now, preview } = useCycle();
  const api = useAppApi();
  const kid = d.roster.find((r) => r.name === m.studentName);
  if (preview || !checkinOpen(t, now) || !kid) return null;
  const here = !!d.tonight.presence[kid.name];
  const ok = selfCheckin(d, kid, now);
  if (!here && !ok.ok) return null;
  return (
    <div className="sr-card flex items-center gap-3 px-[15px] py-[13px]" style={{ boxShadow: here ? undefined : 'inset 0 0 0 1px var(--color-accent-600)' }}>
      <Icon name={here ? 'ph-fill ph-check-circle' : 'ph ph-door-open'} className="flex-none text-[22px] text-accent-300" />
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-[1.25] text-neutral-100">{here ? 'You’re checked in' : 'Here tonight?'}</div>
        <div className="mt-[2px] text-[11.5px] leading-[1.4] text-neutral-500">{here ? 'Pickup is at ' + clock(t.pickup) + '.' : 'Check in so your coach knows. Open until ' + clock(t.end) + '.'}</div>
      </div>
      {!here ? (
        <Btn className="px-4" onClick={() => api().selfCheckIn()}>
          I’m here
        </Btn>
      ) : null}
    </div>
  );
}
