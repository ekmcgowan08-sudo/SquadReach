'use client';
/* The Console's building blocks, shared by every tab. */
import { useState, type ReactNode } from 'react';
import { useAppApi } from '@/lib/store/provider';
import type { MinistryConfig } from '@/lib/types/model';

export function Section({ title, sub, children, right }: { title: string; sub?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="sr-card mb-4 flex flex-col gap-3 px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-medium leading-[1.3] text-neutral-100">{title}</h2>
          {sub ? <p className="mt-1 text-[12px] leading-[1.5] text-neutral-500 text-pretty">{sub}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function useSaveConfig() {
  const api = useAppApi();
  return (patch: Partial<MinistryConfig> | ((c: MinistryConfig) => Partial<MinistryConfig>), note?: string) => {
    api().mutate((x) => {
      const p = typeof patch === 'function' ? patch(x.config) : patch;
      Object.assign(x.config, p);
    });
    api().emit({ kind: 'config', config: api().data.config });
    if (note) api().logActivity(note);
  };
}

/* A field that saves on blur, so typing doesn't sync on every keystroke. */
export function Field({ label, value, onSave, type = 'text', placeholder, hint }: { label: string; value: string | number; onSave: (v: string) => void; type?: string; placeholder?: string; hint?: string }) {
  const [v, setV] = useState(String(value));
  const [last, setLast] = useState(String(value));
  if (String(value) !== last) {
    setLast(String(value));
    setV(String(value));
  }
  return (
    <label className="field">
      <span className="sr-label">{label}</span>
      <input className="input" type={type} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => v !== String(value) && onSave(v)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
      {hint ? <span className="mt-1 text-[11px] leading-[1.4] text-neutral-500">{hint}</span> : null}
    </label>
  );
}

