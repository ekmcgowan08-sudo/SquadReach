'use client';
/* PARENT · TONIGHT — what one family sees: whether their student is in,
   pickup, the last six weeks, tonight's plan, slips to sign and messages
   from the leaders. The parent's Home and the private family link render
   this same card from the same view model (lib/cycle familyView). */
import { Btn, Icon, Label } from '@/components/ui';
import type { FamilyView } from '@/lib/cycle';
import { when } from '@/lib/cycle';

export function FamilyTonightCard({ v, onSign, onRead }: { v: FamilyView; onSign: (slipId: string) => void; onRead: (msgId: string) => void }) {
  return (
    <div data-screen-label="Parent · Tonight" className="sr-card overflow-hidden">
      <div className="px-[15px] pb-3 pt-[15px]">
        <div className="flex items-center gap-2">
          <Label accent>{v.kicker}</Label>
          <span className="h-[6px] w-[6px] rounded-full" style={{ background: v.here ? 'var(--color-accent-400)' : 'var(--color-neutral-600)' }} />
        </div>
        <div className="mt-[7px] text-[17px] font-medium leading-[1.25] text-neutral-100">{v.title}</div>
        <div className="mt-1 text-[12px] leading-[1.45] text-neutral-400 text-pretty">{v.status}</div>
        <div className="mt-3 flex gap-[9px]">
          <div className="flex-1 rounded-md bg-neutral-900 px-[11px] py-[10px]">
            <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">Pickup</div>
            <div className="tabular mt-[5px] text-[17px] font-semibold leading-[1.2] text-neutral-100">{v.pickup}</div>
            <div className="mt-[3px] text-[10px] capitalize leading-[1.3] text-neutral-500">{v.pickupPlace}</div>
          </div>
          <div className="flex-1 rounded-md bg-neutral-900 px-[11px] py-[10px]">
            <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">Last {v.hist.length || 6} weeks</div>
            <div className="mt-2 flex gap-1" role="img" aria-label={'Here ' + v.hist.filter(Boolean).length + ' of the last ' + v.hist.length + ' weeks'}>
              {v.hist.map((h, i) => (
                <span key={i} className="h-[14px] flex-1 rounded-[3px] border" style={{ background: h ? 'var(--color-accent-500)' : 'transparent', borderColor: h ? 'var(--color-accent-500)' : 'var(--color-neutral-700)' }} />
              ))}
              {v.histTonight !== null ? (
                <span title="Tonight" className="h-[14px] flex-1 rounded-[3px] border" style={{ background: v.histTonight ? 'var(--color-accent-300)' : 'transparent', borderColor: 'var(--color-accent-300)' }} />
              ) : null}
            </div>
            <div className="mt-[5px] text-[10px] leading-[1.3] text-neutral-500">
              {v.hist.filter(Boolean).length} of {v.hist.length} before tonight
            </div>
          </div>
        </div>
      </div>

      {v.plan.length ? (
        <div className="border-t border-divider px-[15px] pb-1 pt-[10px]">
          <Label className="mb-1">Tonight’s plan</Label>
          {v.plan.map((b) => (
            <div key={b.at + b.label} className="flex min-h-[30px] items-center gap-[10px] border-b border-divider last:border-b-0">
              <span className="tabular w-[52px] flex-none text-[11px] text-neutral-500">{b.at}</span>
              <span className="flex-1 text-[12px] leading-[1.2] text-neutral-200">{b.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      {v.slips.map((p) => (
        <div key={p.id} className="flex flex-col gap-2 border-t border-divider px-[15px] py-3">
          <div className="flex items-center gap-[9px]">
            <Icon name={'ph ' + (p.signed ? 'ph-check-circle' : 'ph-signature')} className="text-[16px] text-accent-300" />
            <span className="flex-1 text-[12.5px] font-medium leading-[1.3] text-neutral-100">
              {p.title}
              <span className="mt-[2px] block text-[10.5px] font-normal leading-[1.35] text-neutral-500">
                {p.kind} · {p.blocks ? 'a trip waits on it' : 'optional — trips don’t wait on it'}
              </span>
            </span>
            <span className="text-[10.5px] text-neutral-500">{p.due}</span>
          </div>
          {p.signed ? (
            <div className="text-[11px] leading-[1.3] text-neutral-400">Signed by {p.by}</div>
          ) : (
            <Btn className="justify-center" onClick={() => onSign(p.id)}>
              Sign{v.guardian ? ' as ' + v.guardian : ''}
            </Btn>
          )}
        </div>
      ))}

      <div className="border-t border-divider px-[15px] pb-[6px] pt-[10px]">
        <div className="mb-1 flex items-baseline justify-between">
          <Label>From the leaders</Label>
          <span className="text-[10.5px] text-neutral-400">{v.unread ? v.unread + ' new' : ''}</span>
        </div>
        {!v.feed.length ? <div className="py-2 text-[12px] text-neutral-500">Nothing yet.</div> : null}
        {v.feed.slice(0, 5).map((f) => (
          <button key={f.id} onClick={() => !f.read && f.kind === 'msg' && onRead(f.id)} className="flex w-full items-start gap-[10px] border-b border-divider py-[10px] text-left last:border-b-0">
            <span className="mt-[5px] h-[7px] w-[7px] flex-none rounded-full" style={{ background: f.read ? 'transparent' : 'var(--color-accent-400)' }} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] leading-[1.5] text-neutral-200 text-pretty" style={{ fontWeight: f.read ? 400 : 500 }}>
                {f.text}
              </div>
              <div className="mt-[3px] text-[10.5px] leading-[1.3] text-neutral-500">
                {f.from} · {when(f.at)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
