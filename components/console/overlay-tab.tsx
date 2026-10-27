'use client';
/* CONSOLE · RECORDING OVERLAY — what the camera burns into a game clip:
   how big the scoreboard is, how solid, where it sits, and which parts
   show. The preview is drawn by the same function as the recorder, so
   what you see here is what lands on the film. */
import { useEffect, useRef } from 'react';
import { Section, useSaveConfig } from '@/components/console/kit';
import { Btn, Icon, cx } from '@/components/ui';
import { standings } from '@/lib/scoring';
import { OVERLAY_DEFAULTS, drawScorebug, overlayOf, type OverlaySettings } from '@/lib/scorebug';
import { useApp } from '@/lib/store/provider';

const W = 1280;
const H = 720;
const PARTS: { key: keyof OverlaySettings['show']; label: string; icon: string }[] = [
  { key: 'ministry', label: 'Ministry name and week', icon: 'ph ph-church' },
  { key: 'clock', label: 'Game clock', icon: 'ph ph-timer' },
  { key: 'period', label: 'Which period it is', icon: 'ph ph-flag' },
  { key: 'last', label: 'The last thing that happened', icon: 'ph ph-megaphone' }
];

export function OverlayTab() {
  const d = useApp((s) => s.data);
  const saveConfig = useSaveConfig();
  const o = overlayOf(d.config.overlay);
  const canvas = useRef<HTMLCanvasElement>(null);
  const set = (patch: Partial<OverlaySettings>, note?: string) => saveConfig((c) => ({ overlay: { ...overlayOf(c.overlay), ...patch } }), note);

  /* A sample frame: tonight's standings on a dim pitch. */
  const rows = standings(d.teams, d.cats, d.ledger);
  const teams = d.teams.slice(0, 4);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2a3a2e');
    g.addColorStop(1, '#13201a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 60, W - 160, H - 120);
    ctx.beginPath();
    ctx.moveTo(W / 2, 60);
    ctx.lineTo(W / 2, H - 60);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, 90, 0, Math.PI * 2);
    ctx.stroke();
    const tally = Object.fromEntries(teams.map((t) => [t.id, Math.round((rows.find((r) => r.id === t.id)?.total ?? 0) / 100)]));
    drawScorebug(ctx, W, H, { teams, tally, clock: '4:12', period: '2', brand: d.config.ministryName, week: d.config.weekNumber, last: teams[2] ? teams[2].name + ' scores' : '' }, o);
  });

  return (
    <Section title="Recording overlay" sub="What the camera burns into a game clip. Size it, choose how much of the game shows through, put it where it won’t cover the action, and turn off the parts you don’t want on the film. It applies to every phone that films.">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <canvas ref={canvas} width={W} height={H} className="w-full rounded-md border border-neutral-800" role="img" aria-label={'Preview of the scoreboard on a clip: ' + o.position + ', ' + Math.round(o.scale * 100) + '% size'} />
          <p className="text-[12px] leading-[1.5] text-neutral-500">The preview uses tonight’s squads. On a real clip the numbers are the game being filmed, counted from the taps on the filming screen.</p>
        </div>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-[13px] text-neutral-200">How big</span>
            <input type="range" min={60} max={140} step={5} value={Math.round(o.scale * 100)} onChange={(e) => set({ scale: Number(e.target.value) / 100 })} aria-label="Scoreboard size" />
            <span className="text-[12px] text-neutral-500">{Math.round(o.scale * 100)}% of the standard scoreboard</span>
          </label>
          <label className="flex flex-col gap-2">
            <span className="text-[13px] text-neutral-200">How solid</span>
            <input type="range" min={40} max={100} step={2} value={Math.round(o.opacity * 100)} onChange={(e) => set({ opacity: Number(e.target.value) / 100 })} aria-label="Scoreboard backing" />
            <span className="text-[12px] text-neutral-500">{Math.round(o.opacity * 100)}% — lower lets more of the game through</span>
          </label>
          <div className="flex flex-col gap-2">
            <span className="sr-label">What shows</span>
            {PARTS.map((p) => (
              <label key={p.key} className={cx('flex min-h-11 items-center gap-3 rounded-md border px-3', o.show[p.key] ? 'border-accent-700' : 'border-neutral-800')}>
                <Icon name={p.icon} className="text-[15px] text-neutral-300" />
                <span className="flex-1 text-[13.5px] text-neutral-100">{p.label}</span>
                <input type="checkbox" checked={o.show[p.key]} onChange={(e) => set({ show: { ...o.show, [p.key]: e.target.checked } }, 'Overlay: ' + p.label.toLowerCase() + (e.target.checked ? ' on' : ' off'))} />
              </label>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <span className="sr-label">Where it sits</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Where it sits">
              {(['top', 'middle', 'bottom'] as const).map((pos) => (
                <button key={pos} onClick={() => set({ position: pos }, 'Overlay moved to the ' + pos)} aria-pressed={o.position === pos} className={cx('min-h-10 rounded-full border px-4 text-[13px] capitalize', o.position === pos ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                  {pos}
                </button>
              ))}
              <Btn variant="ghost" className="px-3 text-[13px] text-accent-300" onClick={() => saveConfig({ overlay: { ...OVERLAY_DEFAULTS } }, 'Overlay back to the standard scoreboard')}>
                Reset
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
