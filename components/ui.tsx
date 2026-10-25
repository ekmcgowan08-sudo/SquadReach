'use client';
/* The repeated building blocks of the phone screens, written once so the
   type scale, spacing and 44px tap targets are the same everywhere. Values
   are the design's own: 25px screen title, 20px sub-screen title, 15–16px
   card title, 13px body, 12.5px secondary, 11–11.5px meta, 10–10.5px micro
   label. Every tap target is at least 44px tall. */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CSSProperties, ReactNode } from 'react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Icon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const cls = name.startsWith('ph') ? name : 'ph ph-' + name;
  return <i aria-hidden="true" className={cx(cls.includes(' ') ? cls : 'ph ' + cls, className)} style={style} />;
}

/** Every phone screen's frame: 10px top, 18px sides, 24px bottom, 14px gaps. */
export function Screen({ label, children, className, gap = 14 }: { label: string; children: ReactNode; className?: string; gap?: number }) {
  return (
    <div data-screen-label={label} className={cx('flex flex-col px-[18px] pt-[10px] pb-6 animate-sr-rise', className)} style={{ gap }}>
      {children}
    </div>
  );
}

/** The sub-screen header: a round back button, the title, an optional line under it. */
export function ScreenHeader({ title, sub, right, back }: { title: string; sub?: ReactNode; right?: ReactNode; back?: string }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-3">
      <button
        aria-label="Back"
        onClick={() => (back ? router.push(back) : window.history.length > 1 ? router.back() : router.push('/dashboard'))}
        className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 bg-transparent text-neutral-300 sr-hover"
      >
        <Icon name="ph ph-caret-left" className="text-[15px]" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="text-[20px] font-medium leading-[1.2] text-neutral-100">{title}</div>
        {sub ? <div className="mt-[3px] text-[11.5px] leading-[1.3] text-neutral-500">{sub}</div> : null}
      </div>
      {right}
    </div>
  );
}

export function Card({ children, className, style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={cx('sr-card', className)} style={style}>
      {children}
    </div>
  );
}

/** The uppercase micro-label above a section. */
export function Label({ children, className, accent }: { children: ReactNode; className?: string; accent?: boolean }) {
  return (
    <div className={cx('text-[10.5px] font-semibold uppercase leading-none tracking-[.12em]', accent ? 'text-accent-300' : 'text-neutral-500', className)}>
      {children}
    </div>
  );
}

/** A small stat tile on the neutral-900 ground. */
export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex-1 rounded-md bg-neutral-900 px-[11px] py-[10px]', className)}>
      <div className="text-[9.5px] uppercase leading-none tracking-[.08em] text-neutral-500">{label}</div>
      <div className="tabular mt-[5px] text-[17px] font-semibold leading-[1.2] text-neutral-100">{value}</div>
      {hint ? <div className="mt-[3px] text-[10px] leading-[1.3] text-neutral-500">{hint}</div> : null}
    </div>
  );
}

/** Primary: accent OUTLINE on transparent — never a filled block. */
export function Btn({
  children, onClick, variant = 'primary', className, disabled, type = 'button', style, ariaLabel, href, download
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
  ariaLabel?: string;
  href?: string;
  /** A file link (blob: or signed URL): a plain anchor that downloads. */
  download?: string;
}) {
  const cls = cx('btn', 'btn-' + variant, className);
  if (href && download) {
    return (
      <a href={href} download={download} className={cls} style={style} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }
  if (href) {
    return (
      <Link href={href} className={cls} style={style} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls} style={style} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** One screen, one switch — the merged screens' two-way toggle. */
/** One of a few options, side by side — a radio group, not tabs: nothing
 *  here switches between panels. */
export function Switch2<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cx(
              'min-h-11 flex-1 rounded-md border text-[13px] font-medium',
              on ? 'border-accent-500 bg-[color-mix(in_srgb,var(--color-accent)_16%,var(--color-surface))] text-accent-100' : 'border-neutral-800 bg-surface text-neutral-300'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** A selectable pill. Squad chips carry their colour dot. */
export function Chip({
  label, on, onClick, color, count, className
}: { label: ReactNode; on?: boolean; onClick?: () => void; color?: string; count?: ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={!!on}
      className={cx('inline-flex min-h-11 flex-none items-center gap-2 whitespace-nowrap rounded-full border px-[14px] text-[12.5px] font-medium', className)}
      style={{
        borderColor: on ? color ?? 'var(--color-accent-400)' : 'var(--color-neutral-800)',
        background: on ? 'color-mix(in srgb, ' + (color ?? 'var(--color-accent)') + ' 16%, var(--color-surface))' : 'var(--color-surface)',
        color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-300)'
      }}
    >
      {color ? <span className="h-2 w-2 flex-none rounded-full" style={{ background: color }} /> : null}
      {label}
      {count != null ? <span className="text-[11px] font-normal text-neutral-500">{count}</span> : null}
    </button>
  );
}

/** "Previewing what a captain sees" — the fastest way to mislead yourself is
 *  to look at a view without knowing whose it is. */
export function PreviewStrip({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-neutral-700 px-3 py-[9px] text-[11px] leading-[1.45] text-neutral-400">
      <Icon name="ph ph-eye" className="mt-[1px] text-[14px] text-neutral-400" />
      <div className="min-w-0 flex-1 text-pretty">{children}</div>
    </div>
  );
}

/** A tappable list row with icon, label, meta and a caret — the More index grammar. */
export function NavRow({ icon, label, meta, href, onClick, last }: { icon: string; label: string; meta?: string; href?: string; onClick?: () => void; last?: boolean }) {
  const inner = (
    <>
      <Icon name={icon} className="flex-none text-[17px] text-neutral-300" />
      <span className="min-w-0 flex-1 text-[13.5px] font-medium leading-[1.25] text-neutral-100">{label}</span>
      {meta ? <span className="max-w-[48%] truncate text-right text-[11px] text-neutral-500">{meta}</span> : null}
      <Icon name="ph ph-caret-right" className="flex-none text-[12px] text-neutral-600" />
    </>
  );
  const cls = cx('flex min-h-[50px] w-full items-center gap-3 px-[15px] text-left sr-hover', !last && 'border-b border-divider');
  if (href)
    return (
      <Link href={href} className={cls} style={{ color: 'inherit' }}>
        {inner}
      </Link>
    );
  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-dashed border-neutral-700 px-4 py-5 text-center text-[12px] leading-[1.5] text-neutral-500 text-pretty">{children}</div>;
}

/** A small round avatar with initials, tinted with a squad colour. */
export function Avatar({ initials, color, size = 44 }: { initials: string; color?: string; size?: number }) {
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full font-semibold text-neutral-100"
      style={{
        width: size,
        height: size,
        fontSize: size > 40 ? 13 : 11,
        background: color ? 'color-mix(in srgb, ' + color + ' 26%, var(--color-neutral-900))' : 'var(--color-neutral-800)',
        boxShadow: color ? 'inset 0 0 0 1px ' + color : undefined
      }}
    >
      {initials}
    </div>
  );
}

export const tint = (hex: string) => 'color-mix(in srgb, ' + hex + ' 26%, var(--color-neutral-900))';
export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
