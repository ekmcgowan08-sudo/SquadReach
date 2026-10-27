'use client';
/* Scoring rules: the categories points land in, which of them check-in
   pays, and the game players see on Game rules — down to a field map. */
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Field, Section, useSaveConfig } from '@/components/console/kit';
import { GameFormatEditor, GamePlaces, GameTemplates, RulesAudience } from '@/components/console/game-setup';
import { Bracket } from '@/components/game/bracket';
import { Btn, Icon } from '@/components/ui';
import { CHECKIN_PRESENT_PTS } from '@/lib/scoring';
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
            <div key={cat.id} className="flex flex-col gap-2 rounded-lg border border-neutral-800 p-3">
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

/* A drawing pad for the field: a photo of the floor (or nothing), then pen,
   colour and eraser on top. Saved as one small image players see. */
function FieldMap() {
  const gs = useApp((s) => s.data.config.gameSetup);
  const save = useSaveConfig();
  const ref = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#ef4444');
  const [size, setSize] = useState(5);
  const [erasing, setErasing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const drawing = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    ctx.fillStyle = '#1b1d27';
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (gs.markupDataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cv.width, cv.height);
      img.src = gs.markupDataUrl;
    }
  }, [gs.markupDataUrl]);

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * e.currentTarget.width, y: ((e.clientY - r.top) / r.height) * e.currentTarget.height };
  };
  const line = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = erasing ? '#1b1d27' : color;
    ctx.lineWidth = erasing ? size * 4 : size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
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

  return (
    <div className="flex flex-col gap-2">
      <div className="sr-label">Field map</div>
      <canvas
        ref={ref}
        width={960}
        height={540}
        className="w-full touch-none rounded-md border border-neutral-800"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = at(e);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const p = at(e);
          line(drawing.current, p);
          drawing.current = p;
          setDirty(true);
        }}
        onPointerUp={() => (drawing.current = null)}
        aria-label="Field map drawing pad"
      />
      <div className="flex flex-wrap items-center gap-2">
        {['#ef4444', '#facc15', '#22c55e', '#38bdf8', '#ffffff'].map((c) => (
          <button key={c} aria-label={'Pen ' + c} aria-pressed={!erasing && color === c} onClick={() => (setColor(c), setErasing(false))} className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: !erasing && color === c ? '0 0 0 2px var(--color-bg), 0 0 0 4px ' + c : undefined }} />
        ))}
        <select className="input !min-h-10 w-auto" value={size} onChange={(e) => setSize(Number(e.target.value))} aria-label="Pen size">
          <option value={3}>Thin</option>
          <option value={5}>Medium</option>
          <option value={10}>Thick</option>
        </select>
        <Btn variant={erasing ? 'primary' : 'ghost'} className="px-3" onClick={() => setErasing((v) => !v)}>
          Eraser
        </Btn>
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
              ctx.fillStyle = '#1b1d27';
              ctx.fillRect(0, 0, ref.current.width, ref.current.height);
            }
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
    </div>
  );
}
