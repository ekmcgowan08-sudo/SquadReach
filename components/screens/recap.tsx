'use client';
/* RECAP — one 1080×1350 card drawn from tonight's board, ready for the
   ministry's socials. Nothing is typed in: it is the standings, the season
   numbers and the week's verse, as they stand right now. */
import { useEffect, useRef } from 'react';
import { useStandings } from '@/components/dashboard/standings-list';
import { Btn, Icon, Screen, ScreenHeader } from '@/components/ui';
import { verseForWeek } from '@/lib/bible';
import { fmt } from '@/lib/scoring';
import { useApp, useAppApi } from '@/lib/store/provider';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const spacing = (ctx: CanvasRenderingContext2D, px: number) => {
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = px + 'px';
};

export function RecapScreen() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const rows = useStandings();
  const ref = useRef<HTMLCanvasElement>(null);
  const wk = d.config.weekNumber;
  const verse = verseForWeek(d.config.memoryVerses, wk);
  const verseText = verse ? verse.text.KJV ?? Object.values(verse.text)[0] ?? '' : '';
  const caption =
    'Week ' + wk + ' is in the books — ' + (d.config.gameName || 'game night') + '. ' + rows.map((t) => t.name + ' ' + fmt(t.total)).join(' · ') + '. ' + (rows[0] ? rows[0].name + ' leads. ' : '') + 'See you next week.';
  const fileName = 'squadrise-week' + wk + '-recap.png';

  useEffect(() => {
    let alive = true;
    const draw = () => {
      const cv = ref.current;
      const ctx = cv?.getContext('2d');
      if (!cv || !ctx || !alive) return;
      const W = cv.width;
      const H = cv.height;
      const accent = '#9184d9';
      const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
      g.addColorStop(0, '#22253c');
      g.addColorStop(0.5, '#161826');
      g.addColorStop(1, '#0d0f18');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(145,132,217,.5)';
      ctx.fillRect(0, 0, W, 5);
      ctx.textBaseline = 'middle';
      spacing(ctx, 5);
      ctx.font = '600 26px Inter, sans-serif';
      ctx.fillStyle = accent;
      ctx.fillText(d.config.ministryName.toUpperCase(), 76, 120);
      spacing(ctx, 0);
      ctx.font = '500 82px Inter, sans-serif';
      ctx.fillStyle = '#e9e9ed';
      ctx.fillText('Week ' + wk + ' recap', 72, 226);
      ctx.font = '400 30px Inter, sans-serif';
      ctx.fillStyle = 'rgba(233,233,237,.5)';
      ctx.fillText(d.config.gameName || 'Game night', 76, 296);

      const top = Math.max(1, rows[0]?.total ?? 1);
      const rowH = rows.length > 5 ? 92 : 118;
      let y = 400;
      rows.forEach((t, i) => {
        const ry = y + i * rowH;
        ctx.font = '600 28px Inter, sans-serif';
        ctx.fillStyle = i === 0 ? accent : 'rgba(233,233,237,.32)';
        ctx.fillText(String(i + 1), 76, ry + 20);
        roundRect(ctx, 120, ry - 2, 8, 44, 4);
        ctx.fillStyle = t.color;
        ctx.fill();
        ctx.font = '500 36px Inter, sans-serif';
        ctx.fillStyle = '#e9e9ed';
        ctx.fillText(t.name, 148, ry + 20);
        ctx.textAlign = 'right';
        ctx.font = '600 40px Inter, sans-serif';
        ctx.fillStyle = i === 0 ? '#cfc7f2' : '#e9e9ed';
        ctx.fillText(fmt(t.total), W - 76, ry + 20);
        ctx.textAlign = 'left';
        roundRect(ctx, 148, ry + 52, Math.max(8, (W - 224) * (t.total / top)), 8, 4);
        ctx.fillStyle = i === 0 ? accent : 'rgba(233,233,237,.15)';
        ctx.fill();
      });
      y += rows.length * rowH + 40;

      const cells = [
        { n: fmt(rows.reduce((a, t) => a + t.total, 0)), l: 'POINTS ON THE BOARD' },
        { n: String(d.roster.length), l: 'STUDENTS THIS SEASON' },
        { n: String(Math.max(0, d.config.seasonWeeks - wk)), l: 'WEEKS LEFT' }
      ];
      const cw = (W - 152 - 32) / 3;
      cells.forEach((c, i) => {
        const x = 76 + i * (cw + 16);
        roundRect(ctx, x, y, cw, 150, 16);
        ctx.fillStyle = 'rgba(233,233,237,.05)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(233,233,237,.10)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = '600 46px Inter, sans-serif';
        ctx.fillStyle = '#e9e9ed';
        ctx.fillText(c.n, x + 22, y + 58);
        spacing(ctx, 2);
        ctx.font = '500 18px Inter, sans-serif';
        ctx.fillStyle = 'rgba(233,233,237,.42)';
        ctx.fillText(c.l, x + 22, y + 108);
        spacing(ctx, 0);
      });
      y += 200;

      if (verseText) {
        spacing(ctx, 3);
        ctx.font = '600 20px Inter, sans-serif';
        ctx.fillStyle = accent;
        ctx.fillText('MEMORY VERSE · ' + (verse?.ref ?? '').toUpperCase(), 76, y);
        spacing(ctx, 0);
        ctx.font = '400 28px Inter, sans-serif';
        ctx.fillStyle = 'rgba(233,233,237,.72)';
        const words = verseText.split(' ');
        let line = '';
        let ln = 0;
        for (let i = 0; i < words.length && ln < 3; i++) {
          const test = line ? line + ' ' + words[i] : words[i];
          if (ctx.measureText(test).width > W - 152) {
            ctx.fillText(ln === 2 ? line + '…' : line, 76, y + 48 + ln * 42);
            line = words[i];
            ln++;
          } else line = test;
        }
        if (ln < 3 && line) ctx.fillText(line, 76, y + 48 + ln * 42);
      }
      ctx.textBaseline = 'alphabetic';
    };
    /* Inter must be loaded before the canvas measures anything. */
    void document.fonts.ready.then(draw);
    return () => {
      alive = false;
    };
  }, [rows, d.config.ministryName, d.config.gameName, d.config.seasonWeeks, d.roster.length, wk, verse?.ref, verseText]);

  const blob = () => new Promise<Blob | null>((resolve) => ref.current?.toBlob(resolve, 'image/png') ?? resolve(null));

  const save = async () => {
    const b = await blob();
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    api().say('Recap card saved as a PNG.');
  };

  /* The phone's own share sheet: Instagram, Messages, the church's group chat. */
  const share = async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: caption, title: 'Week ' + wk + ' recap' });
        api().logActivity('Shared the Week ' + wk + ' recap card');
      } catch {
        /* closed the share sheet */
      }
    } else {
      await save();
    }
  };

  return (
    <Screen label="Recap">
      <ScreenHeader title={'Week ' + wk + ' recap'} sub="One card, built from tonight’s board" back="/dashboard/more" />
      <canvas ref={ref} width={1080} height={1350} className="block h-auto w-full rounded-lg" style={{ boxShadow: 'var(--shadow-md)' }} aria-label={'Week ' + wk + ' recap card'} role="img" />
      <div className="flex gap-[7px]">
        <Btn className="min-h-[46px] flex-1 justify-center" onClick={() => void save()}>
          <Icon name="ph ph-download-simple" className="mr-[6px] text-[14px]" />
          Save PNG
        </Btn>
        <Btn variant="secondary" className="min-h-[46px] flex-1 justify-center" onClick={() => void share()}>
          <Icon name="ph ph-share-network" className="mr-[6px] text-[14px]" />
          Share
        </Btn>
      </div>
      <div className="flex flex-col gap-2 rounded-md bg-neutral-900 px-3 py-[11px]" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
        <div className="text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Suggested caption</div>
        <div className="text-[11.5px] leading-[1.6] text-neutral-300 text-pretty">{caption}</div>
        <Btn
          variant="ghost"
          className="self-start px-3 text-neutral-200"
          onClick={() => {
            void navigator.clipboard?.writeText(caption).then(
              () => api().say('Caption copied.'),
              () => api().say('Copy is blocked — select it by hand.')
            );
          }}
        >
          Copy caption
        </Btn>
      </div>
    </Screen>
  );
}
