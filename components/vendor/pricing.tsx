'use client';
/* VENDOR · PLANS & BILLING — a calculator, not a checkout. It answers "what
   do we charge a church" with numbers in front of us: four models priced at
   any size, the recommendation and why, what each band includes, and —
   with the live database — what every real ministry would pay under each.
   Vendor-only: no ministry role reaches this page. */
import { useState } from 'react';
import { Icon, cx } from '@/components/ui';
import {
  EXAMPLE_MINISTRY, PRICING_MODELS, PRICING_PLANS, RECOMMENDATION, RECOMMENDED_MODEL, annualFor, dollars, planFor,
  type PricingContext, type PricingModel
} from '@/lib/pricing';
import type { MinistrySize } from '@/lib/vendor-sizes';

/** Seasons when a ministry has none on file: most run two. */
const ASSUMED_SEASONS = 2;
const ctxOf = (m: MinistrySize): PricingContext => ({ students: m.students, leaders: Math.max(1, m.leaders), seasons: m.seasons ?? ASSUMED_SEASONS });

export function VendorPricing({ ministries, mode }: { ministries: MinistrySize[] | null; mode: 'vendor' | 'demo' }) {
  const [c, setC] = useState<PricingContext>(EXAMPLE_MINISTRY);
  const [picked, setPicked] = useState<PricingModel['id']>(RECOMMENDED_MODEL);
  const [from, setFrom] = useState<string | null>(null);
  const all = PRICING_MODELS.map((m) => annualFor(m.id, c));
  const num = (key: keyof PricingContext, min: number, max?: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Math.max(min, Math.min(max ?? Infinity, Math.round(Number(e.target.value) || 0)));
    setC((x) => ({ ...x, [key]: v }));
    setFrom(null);
  };

  return (
    <div className="min-h-dvh bg-bg">
      <header className="border-b border-divider">
        <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-5 py-[14px]">
          <div className="text-[14px] font-bold leading-none tracking-[-.01em] text-neutral-300">
            SQUAD<span className="text-accent-400">RISE</span>
          </div>
          <span className="rounded-full border border-neutral-800 px-[10px] py-[4px] text-[11px] font-medium text-neutral-400">Vendor</span>
          <span className="ml-auto text-[11.5px] text-neutral-500">{mode === 'demo' ? 'Demo build · open because VENDOR_DEMO=1' : 'Only the emails on VENDOR_EMAILS reach this page. No ministry sees a price.'}</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1180px] flex-col gap-7 px-5 pb-16 pt-7">
        <div>
          <h1 className="text-[24px] font-medium leading-[1.2] text-neutral-100">How we charge a church</h1>
          <p className="mt-[6px] max-w-[760px] text-[13px] leading-[1.55] text-neutral-400 text-pretty">
            Four candidate models, priced against a real ministry. Put in your own numbers and the yearly cost under each one moves with them. Pick one to see it carried through. This is not decided — the numbers are what to test on three or four real churches.
          </p>
        </div>

        <section aria-label="Calculator" className="sr-card flex flex-wrap items-end gap-6 px-5 py-4">
          <Field label="Students" value={c.students} min={5} onChange={num('students', 5)} />
          <Field label="Leaders with a login" value={c.leaders} min={1} onChange={num('leaders', 1)} />
          <Field label="Scoring seasons a year" value={c.seasons} min={0} max={4} onChange={num('seasons', 0, 4)} />
          <div className="ml-auto flex gap-8">
            <div>
              <div className="text-[11.5px] text-neutral-500">Under {PRICING_MODELS.find((m) => m.id === picked)!.label.toLowerCase()}</div>
              <div className="tabular mt-1 text-[26px] font-medium leading-none text-neutral-100">
                {dollars(annualFor(picked, c))} <span className="text-[13px] font-normal text-neutral-400">a year</span>
              </div>
            </div>
            <div>
              <div className="text-[11.5px] text-neutral-500">Across all four</div>
              <div className="tabular mt-1 text-[18px] leading-none text-neutral-200">
                {dollars(Math.min(...all))} to {dollars(Math.max(...all))}
              </div>
            </div>
          </div>
          {from ? <div className="w-full text-[11.5px] text-neutral-500">Numbers from {from}.</div> : null}
        </section>

        <section aria-label="Pricing models" className="grid grid-cols-2 gap-3">
          {PRICING_MODELS.map((m) => {
            const annual = annualFor(m.id, c);
            const on = picked === m.id;
            const rec = m.id === RECOMMENDED_MODEL;
            return (
              <button
                key={m.id}
                onClick={() => setPicked(m.id)}
                aria-pressed={on}
                className="flex flex-col gap-3 rounded-lg border px-5 py-4 text-left transition-colors hover:border-accent-600"
                style={{ borderColor: on ? 'var(--color-accent-600)' : rec ? 'var(--color-accent-800)' : 'var(--color-neutral-800)', background: on ? 'color-mix(in srgb, var(--color-accent) 10%, var(--color-surface))' : 'var(--color-surface)' }}
              >
                <div className="flex w-full items-start gap-3">
                  <div className="text-[15px] font-medium text-neutral-100">{m.label}</div>
                  {rec ? <span className="rounded-full border border-accent-700 px-2 py-[2px] text-[10.5px] font-semibold text-accent-200">Our recommendation</span> : null}
                  <div className="ml-auto text-right">
                    <div className="tabular text-[20px] font-medium leading-none text-neutral-100">
                      {dollars(annual)}
                      <span className="text-[12px] font-normal text-neutral-400"> / yr</span>
                    </div>
                    <div className="mt-1 text-[11.5px] text-neutral-500">
                      {m.detail(c)} · {dollars(annual / 12)} a month
                    </div>
                  </div>
                </div>
                <div className="text-[12.5px] leading-[1.5] text-neutral-300 text-pretty">{m.how}</div>
                <div className="flex flex-col gap-[6px]">
                  <div className="flex gap-2 text-[12px] leading-[1.5] text-neutral-300">
                    <Icon name="ph ph-plus" className="mt-[3px] flex-none text-[12px] text-accent-300" />
                    <span className="text-pretty">{m.good}</span>
                  </div>
                  <div className="flex gap-2 text-[12px] leading-[1.5] text-neutral-400">
                    <Icon name="ph ph-minus" className="mt-[3px] flex-none text-[12px] text-neutral-500" />
                    <span className="text-pretty">{m.bad}</span>
                  </div>
                </div>
                <div className="text-[11.5px] text-neutral-500">${(annual / Math.max(1, c.students)).toFixed(2)} per student per year</div>
              </button>
            );
          })}
        </section>

        <section className="flex gap-3 rounded-lg border border-accent-800 px-5 py-4" style={{ background: 'color-mix(in srgb, var(--color-accent) 6%, var(--color-surface))' }}>
          <Icon name="ph ph-seal-check" className="mt-[2px] flex-none text-[20px] text-accent-300" />
          <div>
            <div className="text-[15px] font-medium text-neutral-100">{RECOMMENDATION.title}</div>
            <p className="mt-1 max-w-[900px] text-[12.5px] leading-[1.6] text-neutral-300 text-pretty">{RECOMMENDATION.why}</p>
          </div>
        </section>

        <section aria-labelledby="bands">
          <h2 id="bands" className="text-[17px] font-medium text-neutral-100">
            What each band includes
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {PRICING_PLANS.map((p) => (
              <div key={p.id} className="flex flex-col gap-3 rounded-lg border px-5 py-4" style={{ borderColor: p.recommended ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', background: 'var(--color-surface)' }}>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-[15px] font-medium text-neutral-100">{p.label}</div>
                    {p.recommended ? <span className="rounded-full border border-accent-700 px-2 py-[2px] text-[10.5px] font-semibold text-accent-200">Most churches</span> : null}
                  </div>
                  <div className="tabular mt-1 text-[18px] text-neutral-100">{p.priceLabel}</div>
                  <div className="mt-[2px] text-[12px] text-neutral-400">{p.who}</div>
                </div>
                <div className="flex flex-col gap-[6px] border-t border-divider pt-3">
                  {p.includes.map((i) => (
                    <div key={i} className="flex gap-2 text-[12.5px] leading-[1.45] text-neutral-200">
                      <Icon name="ph ph-check" className="mt-[3px] flex-none text-[12px] text-accent-300" />
                      {i}
                    </div>
                  ))}
                  {p.limits.map((l) => (
                    <div key={l} className="flex gap-2 text-[12.5px] leading-[1.45] text-neutral-400">
                      <Icon name="ph ph-minus" className="mt-[3px] flex-none text-[12px] text-neutral-500" />
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section aria-labelledby="ministries">
          <h2 id="ministries" className="text-[17px] font-medium text-neutral-100">
            Every ministry, under each model
          </h2>
          {ministries === null ? (
            <p className="mt-2 text-[12.5px] leading-[1.55] text-neutral-400">{mode === 'demo' ? 'The demo has no real ministries. With Supabase and SUPABASE_SERVICE_ROLE_KEY set, every ministry is priced here.' : 'Set SUPABASE_SERVICE_ROLE_KEY on the server to price every ministry here.'}</p>
          ) : !ministries.length ? (
            <p className="mt-2 text-[12.5px] text-neutral-400">No ministries yet.</p>
          ) : (
            <MinistryTable ministries={ministries} onPick={(m) => (setC(ctxOf(m)), setFrom(m.name))} />
          )}
        </section>
      </main>
    </div>
  );
}

function Field({ label, value, min, max, onChange }: { label: string; value: number; min: number; max?: number; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <label className="field !m-0 w-[170px]">
      <span>{label}</span>
      <input type="number" inputMode="numeric" className="input tabular" value={value} min={min} max={max} onChange={onChange} />
    </label>
  );
}

function MinistryTable({ ministries, onPick }: { ministries: MinistrySize[]; onPick: (m: MinistrySize) => void }) {
  const totals = PRICING_MODELS.map((model) => ministries.reduce((n, m) => n + annualFor(model.id, ctxOf(m)), 0));
  const th = 'px-3 py-2 text-left text-[11px] font-medium text-neutral-500';
  const td = 'px-3 py-2 text-[12.5px] text-neutral-200';
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-800">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-800">
            <th className={th}>Ministry</th>
            <th className={cx(th, 'text-right')}>Students</th>
            <th className={cx(th, 'text-right')}>Leaders</th>
            <th className={cx(th, 'text-right')}>Seasons</th>
            <th className={th}>Band</th>
            {PRICING_MODELS.map((m) => (
              <th key={m.id} className={cx(th, 'text-right')}>
                {m.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ministries.map((m) => {
            const c = ctxOf(m);
            return (
              <tr key={m.id} className="border-b border-divider">
                <td className={td}>
                  <button onClick={() => onPick(m)} className="min-h-11 text-left text-neutral-100 underline decoration-neutral-700 underline-offset-4 hover:decoration-accent-400" title="Put this ministry in the calculator">
                    {m.name}
                  </button>
                </td>
                <td className={cx(td, 'tabular text-right')}>{m.students}</td>
                <td className={cx(td, 'tabular text-right')}>{m.leaders}</td>
                <td className={cx(td, 'tabular text-right')} title={m.seasons === null ? 'None on file — assumed ' + ASSUMED_SEASONS : undefined}>
                  {m.seasons ?? <span className="text-neutral-500">{ASSUMED_SEASONS}*</span>}
                </td>
                <td className={td}>{PRICING_PLANS.find((p) => p.id === planFor(m.students))!.label}</td>
                {PRICING_MODELS.map((model) => (
                  <td key={model.id} className={cx(td, 'tabular text-right', model.id === RECOMMENDED_MODEL && 'text-neutral-100')}>
                    {dollars(annualFor(model.id, c))}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <td className={cx(td, 'font-medium text-neutral-100')} colSpan={5}>
              A year, all {ministries.length} {ministries.length === 1 ? 'ministry' : 'ministries'}
            </td>
            {totals.map((t, i) => (
              <td key={PRICING_MODELS[i].id} className={cx(td, 'tabular text-right font-medium text-neutral-100')}>
                {dollars(t)}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <div className="px-3 py-2 text-[11px] text-neutral-500">* No season saved in the last year; counted as {ASSUMED_SEASONS}. Leaders are coaches, scorekeepers, leaders and owners with a login. Students are the roster, guests left out.</div>
    </div>
  );
}
