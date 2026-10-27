/* The scoreboard burned into game film. One drawing function, so the
   recorder and the console's preview can't disagree about what lands on
   the clip. Size, how solid it is, where it sits and which parts show are
   the ministry's overlay settings (Console › Recording overlay). */

export interface OverlaySettings {
  /** 1 is the standard scoreboard. */
  scale: number;
  /** How solid the backing is: lower lets more of the game through. */
  opacity: number;
  position: 'top' | 'middle' | 'bottom';
  show: { ministry: boolean; clock: boolean; period: boolean; last: boolean };
}

export const OVERLAY_DEFAULTS: OverlaySettings = { scale: 1, opacity: 0.82, position: 'bottom', show: { ministry: true, clock: true, period: true, last: true } };

export const overlayOf = (o: Partial<OverlaySettings> | undefined): OverlaySettings => ({ ...OVERLAY_DEFAULTS, ...o, show: { ...OVERLAY_DEFAULTS.show, ...o?.show } });

export interface ScorebugState {
  teams: { id: string; name: string; color: string }[];
  tally: Record<string, number>;
  clock: string;
  /** "1"…"4" or "OT". */
  period: string;
  brand: string;
  week: number;
  /** The last thing that happened, e.g. "Blue scored". */
  last: string;
}

export const abbr = (name: string) => name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '—';

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The scoreboard's size before scaling, for laying it out. */
export function scorebugSize(n: number, o: OverlaySettings) {
  const box = o.show.clock || o.show.period;
  return { w: n * 132 + (box ? 150 : 14), h: 68 + (o.show.ministry ? 28 : 0) };
}

/** Draw the scoreboard onto a W×H frame. */
export function drawScorebug(ctx: CanvasRenderingContext2D, W: number, H: number, s: ScorebugState, o: OverlaySettings) {
  const n = s.teams.length;
  if (!n) return;
  const { w: bw, h: bh } = scorebugSize(n, o);
  const head = o.show.ministry ? 28 : 0;
  const sc = o.scale;
  const x0 = 36;
  const y0 = o.position === 'top' ? 76 : o.position === 'middle' ? (H - bh * sc) / 2 : H - 36 - bh * sc;
  ctx.save();
  ctx.translate(x0, y0);
  ctx.scale(sc, sc);
  ctx.textBaseline = 'middle';

  /* The last thing that happened: a pill on the open side of the board. */
  if (o.show.last && s.last) {
    ctx.font = '600 15px Inter, sans-serif';
    const tw = ctx.measureText(s.last).width + 28;
    const py = o.position === 'bottom' ? -40 : bh + 8;
    rr(ctx, 0, py, tw, 32, 16);
    ctx.fillStyle = 'rgba(10,11,20,' + Math.min(1, o.opacity + 0.08) + ')';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(s.last, 14, py + 16);
  }

  rr(ctx, 0, 0, bw, bh, 12);
  ctx.fillStyle = 'rgba(10,11,20,' + o.opacity + ')';
  ctx.fill();

  if (o.show.ministry) {
    ctx.font = '700 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(233,233,237,.75)';
    ctx.textAlign = 'left';
    ctx.fillText(s.brand.toUpperCase(), 14, 15);
    ctx.textAlign = 'right';
    ctx.font = '500 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(233,233,237,.55)';
    ctx.fillText('Week ' + s.week, bw - 14, 15);
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(0, head - 1, bw, 1);
  }

  s.teams.forEach((t, i) => {
    const x = i * 132;
    ctx.fillStyle = t.color;
    ctx.fillRect(x + 12, head + 14, 6, 40);
    ctx.font = '600 20px Inter, sans-serif';
    ctx.fillStyle = 'rgba(233,233,237,.8)';
    ctx.textAlign = 'left';
    ctx.fillText(abbr(t.name), x + 28, head + 34);
    ctx.font = '700 30px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(String(s.tally[t.id] ?? 0), x + 124, head + 35);
  });

  if (o.show.clock || o.show.period) {
    const cx = n * 132 + 10;
    ctx.fillStyle = 'rgba(145,132,217,.9)';
    rr(ctx, cx, head + 12, 128, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    const label = s.period === 'OT' ? 'OVERTIME' : 'PERIOD ' + s.period;
    if (o.show.clock && o.show.period) {
      ctx.font = '700 24px Inter, sans-serif';
      ctx.fillText(s.clock, cx + 64, head + 30);
      ctx.font = '600 12px Inter, sans-serif';
      ctx.fillText(label, cx + 64, head + 49);
    } else if (o.show.clock) {
      ctx.font = '700 26px Inter, sans-serif';
      ctx.fillText(s.clock, cx + 64, head + 35);
    } else {
      ctx.font = '700 16px Inter, sans-serif';
      ctx.fillText(label, cx + 64, head + 35);
    }
  }
  ctx.restore();
}
