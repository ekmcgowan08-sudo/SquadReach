/* The frame for the signed-out pages: the same phone column and Nocturne
   ground as the app, with the wordmark on top. */
import type { ReactNode } from 'react';

export function AuthFrame({ children, title, sub }: { children: ReactNode; title: string; sub?: ReactNode }) {
  return (
    <main className="flex min-h-dvh justify-center px-4" style={{ background: 'radial-gradient(120% 80% at 50% 0%, var(--color-neutral-800) 0%, var(--color-bg) 70%)' }}>
      <div className="flex w-full max-w-[420px] flex-col gap-5 py-12">
        <div className="text-[15px] font-bold leading-none tracking-[-.01em] text-neutral-300">
          SQUAD<span className="text-accent-400">RISE</span>
        </div>
        <div>
          <h1 className="text-[26px] font-medium leading-[1.15] text-neutral-100 text-pretty">{title}</h1>
          {sub ? <p className="mt-2 text-[13px] leading-[1.55] text-neutral-400 text-pretty">{sub}</p> : null}
        </div>
        {children}
      </div>
    </main>
  );
}
