'use client';
/* Scoring rules: the categories points land in, which of them check-in
   pays, and the game players see on Game rules — down to a field map. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Field, Section, useSaveConfig } from '@/components/console/kit';
import { GameFormatEditor, GamePlaces, GameTemplates, RulesAudience, RulesDraft } from '@/components/console/game-setup';
import { Bracket } from '@/components/game/bracket';
import { Btn, Icon } from '@/components/ui';
import { CHECKIN_PRESENT_PTS, fmt, pointBase } from '@/lib/scoring';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Category } from '@/lib/types/model';

const ICONS = ['ph ph-user-check', 'ph ph-t-shirt', 'ph ph-book-bookmark', 'ph ph-book-open-text', 'ph ph-user-plus', 'ph ph-trophy', 'ph ph-video-camera', 'ph ph-hand-heart', 'ph ph-music-notes', 'ph ph-star'];
const COLORS = ['#EA580C', '#DB2777', '#0891B2', '#968ae0', '#7C3AED', '#0D9488', '#65A30D', '#CA8A04', '#DC2626', '#2563EB'];

export function ScoringTab() {
  const d = useApp((s) => s.data);
  const api = useAppApi();
  const save = useSaveConfig();
  const c = d.config;
  const gs = c.gameSetup;

  const saveCat = (cat: Category, note?: string) => {
    api().mutate((x) => {
      const i = x.cats.findIndex((y) => y.id === cat.id);
      if (i >= 0) x.cats[i] = cat;
      else x.cats.push(cat);
    });
    const sort = api().data.cats.findIndex((y) => y.id === cat.id);
    api().emit({ kind: 'category', cat, sort });
    if (note) api().logActivity(note);
  };

  return (
    <>
      <Section
        title="Point categories"
        sub="Every point lands in one of these. Removing one archives it — points already in it stay counted."
        right={
          <Btn
            className="px-3"
            onClick={() => {
              const key = 'cat' + Math.random().toString(36).slice(2, 7);
              saveCat({ id: key, label: 'New category', color: COLORS[d.cats.length % COLORS.length], icon: 'ph ph-star', hint: '' }, 'Added a point category');
            }}
          >
            + Category
          </Btn>
        }
      >
        <div className="flex flex-col gap-3">
          {d.cats.map((cat) => (
            <div key={cat.id} role="group" aria-label={'Category: ' + cat.label} className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-md" style={{ background: 'color-mix(in srgb, ' + cat.color + ' 22%, transparent)', color: cat.color }}>
                  <Icon name={cat.icon} className="text-[18px]" />
                </div>
                <div className="w-44">
                  <Field label="Label" value={cat.label} onSave={(v) => v.trim() && saveCat({ ...cat, label: v.trim() })} />
                </div>
                <div className="min-w-[200px] flex-1">
                  <Field label="What earns it" value={cat.hint} onSave={(v) => saveCat({ ...cat, hint: v.trim() })} />
                </div>
                {!['general'].includes(cat.id) ? (
                  <Btn
                    variant="ghost"
                    className="px-3"
                    onClick={() => {
                      if (!window.confirm('Remove ' + cat.label + '? Points already in it stay counted.')) return;
                      api().mutate((x) => void (x.cats = x.cats.filter((y) => y.id !== cat.id)));
                      api().emit({ kind: 'categoryRemove', id: cat.id });
                    }}
                  >
                    Remove
                  </Btn>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-[6px]">
                {COLORS.map((col) => (
                  <button key={col} aria-label={'Colour ' + col} aria-pressed={cat.color === col} onClick={() => saveCat({ ...cat, color: col })} className="h-7 w-7 rounded-full" style={{ background: col, boxShadow: cat.color === col ? '0 0 0 2px var(--color-bg), 0 0 0 4px ' + col : undefined }} />
                ))}
                <span className="mx-1 w-px bg-divider" />
                {ICONS.map((ic) => (
                  <button key={ic} aria-label={'Icon ' + ic} aria-pressed={cat.icon === ic} onClick={() => saveCat({ ...cat, icon: ic })} className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: cat.icon === ic ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'transparent', color: cat.icon === ic ? 'var(--color-accent-100)' : 'var(--color-neutral-500)' }}>
                    <Icon name={ic} className="text-[14px]" />
                  </button>
                ))}
              </div>
              <CatBase id={cat.id} />
            </div>
          ))}
        </div>
      </Section>

      <Section title="What check-in pays" sub={'Marking a student present pays ' + CHECKIN_PRESENT_PTS + ' to General, plus each category switched on here. Marking present IS the scoring step.'}>
        <div className="flex flex-wrap gap-2">
          {d.cats
            .filter((x) => x.id !== 'general')
            .map((cat) => {
              const on = !!c.checkinAutoCats[cat.id];
              return (
                <button
                  key={cat.id}
                  onClick={() => save((cc) => ({ checkinAutoCats: { ...cc.checkinAutoCats, [cat.id]: !on } }), (on ? 'Stopped' : 'Started') + ' paying ' + cat.label + ' on check-in')}
                  aria-pressed={on}
                  className="flex min-h-11 items-center gap-2 rounded-full border px-3 text-[12.5px] font-medium"
                  style={{ borderColor: on ? cat.color : 'var(--color-neutral-800)', color: on ? 'var(--color-neutral-100)' : 'var(--color-neutral-400)', background: on ? 'color-mix(in srgb, ' + cat.color + ' 14%, transparent)' : 'transparent' }}
                >
                  <Icon name={on ? 'ph-fill ph-check-circle' : 'ph ph-circle'} className="text-[14px]" />
                  {cat.label}
                </button>
              );
            })}
        </div>
      </Section>

      <Section title="The game" sub="What players see on Game rules: when, where, how, and the field map.">
        <RulesDraft />
        <label className="field">
          <span className="sr-label">Rules</span>
          <textarea className="input !min-h-32" defaultValue={gs.rulesText} key={'rules-' + gs.rulesText.length} onBlur={(e) => e.target.value !== gs.rulesText && save((cc) => ({ gameSetup: { ...cc.gameSetup, rulesText: e.target.value } }), 'Updated the game rules')} placeholder="How it works, how it’s scored, what gets a penalty." />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="How-to video (YouTube link)" value={gs.rulesVideoUrl} onSave={(v) => save((cc) => ({ gameSetup: { ...cc.gameSetup, rulesVideoUrl: v.trim() } }))} />
          <Field label="Offsite address (overrides the home venue)" value={gs.offsiteAddress} onSave={(v) => save((cc) => ({ gameSetup: { ...cc.gameSetup, offsiteAddress: v.trim() } }))} />
        </div>
        <GamePlaces />
        <GameFormatEditor />
        <div>
          <div className="sr-label mb-2">Weeks with a game</div>
          <div className="flex flex-wrap gap-2">
            <button aria-pressed={!gs.gameWeeks} onClick={() => save((cc) => ({ gameSetup: { ...cc.gameSetup, gameWeeks: null } }))} className="min-h-11 rounded-full border px-3 text-[12.5px] font-medium" style={{ borderColor: !gs.gameWeeks ? 'var(--color-accent-500)' : 'var(--color-neutral-800)', color: !gs.gameWeeks ? 'var(--color-accent-100)' : 'var(--color-neutral-400)' }}>
              Every week
            </button>
            {Array.from({ length: c.seasonWeeks }, (_, i) => i + 1).map((w) => {
              const on = !gs.gameWeeks || gs.gameWeeks.includes(w);
              return (
                <button
                  key={w}
                  aria-pressed={on}
                  onClick={() =>
                    save((cc) => {
                      const cur = cc.gameSetup.gameWeeks ?? Array.from({ length: cc.seasonWeeks }, (_, i) => i + 1);
                      return { gameSetup: { ...cc.gameSetup, gameWeeks: cur.includes(w) ? cur.filter((x) => x !== w) : [...cur, w].sort((a, b) => a - b) } };
                    })
                  }
                  className="min-h-11 min-w-11 rounded-full border px-2 text-[12.5px] font-medium"
                  style={{ borderColor: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)', color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-500)' }}
                >
                  W{w}
                </button>
              );
            })}
          </div>
        </div>
        <FieldMap />
        <RulesAudience />
        <GameTemplates />
        <div className="text-[11.5px] text-neutral-500">
          Penalty and bonus buttons are in{' '}
          <Link href="/console?tab=live" className="text-accent-300 underline underline-offset-2">
            Live control
          </Link>{' '}
          and behind the sliders icon on the game timer.
        </div>
      </Section>
      <Bracket editable />
    </>
  );
}

/* A drawing pad for the field: a photo of the floor (or nothing), then a
   round or square brush, colour, eraser and text labels on top. Saved as
   one small image players see. */
type Tool = 'pen' | 'eraser' | 'text';
type Label = { x: number; y: number; left: number; top: number; text: string };
const PAD = '#1b1d27';

function FieldMap() {
  const gs = useApp((s) => s.data.config.gameSetup);
  const save = useSaveConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#ef4444');
  const [size, setSize] = useState(5);
  const [shape, setShape] = useState<'round' | 'square'>('round');
  const [tool, setTool] = useState<Tool>('pen');
  const [dirty, setDirty] = useState(false);
  /* How many screen pixels one canvas pixel takes, for the brush cursor. */
  const [scale, setScale] = useState(1);
  const [label, setLabelState] = useState<Label | null>(null);
  /* The open label, read by commit: Enter and the blur that follows it
     (or a tap elsewhere) must not set the same text twice. */
  const open = useRef<Label | null>(null);
  const setLabel = (l: Label | null) => {
    open.current = l;
    setLabelState(l);
  };
  const drawing = useRef<{ x: number; y: number } | null>(null);
  const labelRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    ctx.fillStyle = PAD;
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (gs.markupDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cv.width, cv.height);
      img.src = gs.markupDataUrl;
    }
  }, [gs.markupDataUrl]);

  useEffect(() => {
    if (label) labelRef.current?.focus();
  }, [label]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = tool === 'eraser' ? PAD : color;
    ctx.lineWidth = tool === 'eraser' ? size * 4 : size;
    ctx.lineCap = shape;
    ctx.lineJoin = shape === 'square' ? 'miter' : 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };
  /* Text in the pen colour, sized with the brush, set where it was tapped. */
  const commitLabel = () => {
    const l = open.current;
    const ctx = ref.current?.getContext('2d');
    if (l && l.text.trim() && ctx) {
      ctx.font = '600 ' + (14 + size * 2) + 'px Inter, sans-serif';
      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(l.text.trim(), l.x, l.y);
      setDirty(true);
    }
    setLabel(null);
  };
  const background = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const cv = ref.current;
      const ctx = cv?.getContext('2d');
      if (cv && ctx) {
        const s = Math.max(cv.width / img.width, cv.height / img.height);
        ctx.drawImage(img, (cv.width - img.width * s) / 2, (cv.height - img.height * s) / 2, img.width * s, img.height * s);
        setDirty(true);
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  /* The cursor is the brush itself: its size and shape, at screen scale. */
  const diam = Math.max(6, Math.round((tool === 'eraser' ? size * 4 : size) * scale) + 2);
  const half = diam / 2;
  const ink = tool === 'eraser' ? '#ffffff' : color;
  const mark =
    shape === 'square'
      ? '<rect x="1" y="1" width="' + (diam - 2) + '" height="' + (diam - 2) + '" fill="none" stroke="' + ink + '" stroke-width="1.5"/>'
      : '<circle cx="' + half + '" cy="' + half + '" r="' + (half - 1) + '" fill="none" stroke="' + ink + '" stroke-width="1.5"/>';
  const cursor = tool === 'text' ? 'text' : 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="' + diam + '" height="' + diam + '">' + mark + '</svg>') + '") ' + Math.round(half) + ' ' + Math.round(half) + ', crosshair';
  const toolBtn = (on: boolean) => ({
    borderColor: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)',
    background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
    color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)'
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="sr-label">Field map</div>
      <div className="relative">
        <canvas
          ref={ref}
          width={960}
          height={540}
          className="block w-full touch-none rounded-md border border-neutral-800"
          style={{ cursor }}
          onPointerEnter={(e) => setScale(e.currentTarget.getBoundingClientRect().width / e.currentTarget.width)}
          /* Keep focus in the label being placed rather than blurring it. */
          onMouseDown={(e) => tool === 'text' && e.preventDefault()}
          onPointerDown={(e) => {
            const p = at(e);
            if (tool === 'text') {
              commitLabel();
              const r = e.currentTarget.getBoundingClientRect();
              setLabel({ x: p.x, y: p.y, left: e.clientX - r.left, top: e.clientY - r.top, text: '' });
              return;
            }
            e.currentTarget.setPointerCapture(e.pointerId);
            drawing.current = p;
            /* A tap leaves one mark, round or square, the size of the brush. */
            line(p, p);
            setDirty(true);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const p = at(e);
            line(drawing.current, p);
            drawing.current = p;
          }}
          onPointerUp={() => (drawing.current = null)}
          aria-label="Field map drawing pad"
        />
        {label ? (
          <input
            ref={labelRef}
            value={label.text}
            onChange={(e) => setLabel({ ...label, text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitLabel();
              if (e.key === 'Escape') {
                e.stopPropagation();
                setLabel(null);
              }
            }}
            onBlur={commitLabel}
            placeholder="Label…"
            aria-label="Label on the map"
            className="absolute min-h-9 w-[180px] rounded border border-accent-600 bg-bg px-2 text-[13px] font-semibold outline-none"
            style={{ left: Math.max(0, label.left), top: Math.max(0, label.top), color }}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {['#ef4444', '#facc15', '#22c55e', '#38bdf8', '#ffffff'].map((c) => (
          <button
            key={c}
            aria-label={'Pen ' + c}
            aria-pressed={tool !== 'eraser' && color === c}
            onClick={() => (setColor(c), setTool((t) => (t === 'eraser' ? 'pen' : t)))}
            className="h-8 w-8 rounded-full"
            style={{ background: c, boxShadow: tool !== 'eraser' && color === c ? '0 0 0 2px var(--color-bg), 0 0 0 4px ' + c : undefined }}
          />
        ))}
        <select className="input !min-h-10 w-auto" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Pen size">
          <option value={3}>Thin</option>
          <option value={5}>Medium</option>
          <option value={10}>Thick</option>
        </select>
        <div role="group" aria-label="Brush shape" className="flex gap-1">
          {(['round', 'square'] as const).map((sh) => (
            <button
              key={sh}
              aria-pressed={shape === sh}
              aria-label={sh === 'round' ? 'Round brush' : 'Square brush'}
              onClick={() => setShape(sh)}
              className="flex h-11 w-11 items-center justify-center rounded-md border"
              style={toolBtn(shape === sh)}
            >
              <Icon name={sh === 'round' ? 'ph-fill ph-circle' : 'ph-fill ph-square'} className="text-[14px]" />
            </button>
          ))}
        </div>
        <button aria-pressed={tool === 'text'} onClick={() => setTool((t) => (t === 'text' ? 'pen' : 'text'))} className="flex min-h-11 items-center gap-[6px] rounded-md border px-3 text-[12.5px] font-medium" style={toolBtn(tool === 'text')}>
          <Icon name="ph ph-text-t" className="text-[15px]" />
          Text
        </button>
        <button aria-pressed={tool === 'eraser'} onClick={() => setTool((t) => (t === 'eraser' ? 'pen' : 'eraser'))} className="flex min-h-11 items-center gap-[6px] rounded-md border px-3 text-[12.5px] font-medium" style={toolBtn(tool === 'eraser')}>
          <Icon name="ph ph-eraser" className="text-[15px]" />
          Eraser
        </button>
        <label className="btn btn-ghost min-h-11 cursor-pointer px-3">
          Photo underneath
          <input type="file" accept="image/*" className="hidden" onChange={(e) => background(e.target.files?.[0])} />
        </label>
        <span className="flex-1" />
        <Btn
          variant="ghost"
          className="px-3"
          onClick={() => {
            save((cc) => ({ gameSetup: { ...cc.gameSetup, markupDataUrl: null } }));
            const ctx = ref.current?.getContext('2d');
            if (ctx && ref.current) {
              ctx.fillStyle = PAD;
              ctx.fillRect(0, 0, ref.current.width, ref.current.height);
            }
            setLabel(null);
            setDirty(false);
          }}
        >
          Clear
        </Btn>
        <Btn
          className="px-4"
          disabled={!dirty}
          onClick={() => {
            const url = ref.current?.toDataURL('image/jpeg', 0.7);
            if (url) save((cc) => ({ gameSetup: { ...cc.gameSetup, markupDataUrl: url } }), 'Updated the field map');
            setDirty(false);
          }}
        >
          Save map
        </Btn>
      </div>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500">{tool === 'text' ? 'Tap the map where a label goes, type it, then press Enter.' : 'Draw lanes, bases and the out-of-bounds line. A tap leaves one mark the size and shape of the brush.'}</div>
    </div>
  );
}

/* A category's own starting base and weekly growth. Empty fields follow
   the season number in Setup › Point values. */
function CatBase({ id }: { id: string }) {
  const c = useApp((s) => s.data.config);
  const save = useSaveConfig();
  const own = c.catCfg?.[id] ?? {};
  const set = (patch: { base?: number | null; growth?: number | null }) => save((cc) => ({ catCfg: { ...cc.catCfg, [id]: { ...cc.catCfg?.[id], ...patch } } }));
  const num = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.round(Number(v)) || 0));
  const follows = own.base == null && own.growth == null;
  return (
    <div className="flex flex-wrap items-end gap-3 border-t border-divider pt-2">
      <div className="w-32">
        <Field label="Starting base" type="number" value={own.base ?? ''} placeholder={String(c.pointBase)} onSave={(v) => set({ base: num(v) })} />
      </div>
      <div className="w-32">
        <Field label="Weekly growth %" type="number" value={own.growth ?? ''} placeholder={String(c.weekGrowthPct)} onSave={(v) => set({ growth: num(v) })} />
      </div>
      <div className="pb-2 text-[11.5px] leading-[1.4] text-neutral-400">
        Week 1 {fmt(pointBase(c, id, 1))} → week {c.seasonWeeks} {fmt(pointBase(c, id, c.seasonWeeks))}
        <span className="block text-neutral-500">{follows ? 'Following the season number' : 'Its own number'}</span>
      </div>
    </div>
  );
}
