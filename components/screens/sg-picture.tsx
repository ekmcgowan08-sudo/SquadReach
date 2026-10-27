'use client';
/* A small-group screen's picture: the editor that picks one (a drawn tile
   from the bank, found by word, or a photo shrunk on the phone) and places
   it, and the view the player draws it with. */
import { useState, type CSSProperties } from 'react';
import { Icon } from '@/components/ui';
import { shrinkImage } from '@/lib/image';
import { DEFAULT_IMAGE, LAYERS, cleanImage, pictureOf, searchPictures } from '@/lib/small-group-ideas';
import type { SmallGroupImage } from '@/lib/types/model';

const seg = (on: boolean): CSSProperties => ({
  borderColor: on ? 'var(--color-accent-600)' : 'var(--color-neutral-800)',
  background: on ? 'color-mix(in srgb, var(--color-accent) 16%, transparent)' : 'transparent',
  color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)'
});

/** The picture itself, filling whatever box it's given. */
export function PictureFill({ image, fade = false, iconSize = 26 }: { image: SmallGroupImage; fade?: boolean; iconSize?: number }) {
  const opacity = fade ? image.opacity / 100 : 1;
  if (image.src)
    return (
      <div
        role="img"
        aria-label="Picture"
        className="h-full w-full bg-cover bg-no-repeat"
        style={{ backgroundImage: 'url("' + image.src + '")', backgroundPosition: image.posX + '% ' + image.posY + '%', opacity, transform: 'scale(' + image.scale / 100 + ')' }}
      />
    );
  const bank = pictureOf(image.bankId);
  if (!bank) return null;
  return (
    <div role="img" aria-label={bank.label} className="flex h-full w-full items-center justify-center" style={{ background: bank.color, opacity }}>
      <Icon name={bank.icon} className="text-white/60" style={{ fontSize: iconSize * (image.scale / 100) }} />
    </div>
  );
}

/** Where the player puts it: a framed picture above or below the words. */
export function PictureFrame({ image }: { image: SmallGroupImage }) {
  return (
    <div className="h-[140px] w-full max-w-[240px] flex-none overflow-hidden rounded-md">
      <PictureFill image={image} iconSize={52} />
    </div>
  );
}

export function PictureEditor({ image, onChange }: { image: SmallGroupImage | null | undefined; onChange: (img: SmallGroupImage | null) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (p: Partial<SmallGroupImage>) => image && onChange(cleanImage({ ...image, ...p }));
  const pick = (p: Partial<SmallGroupImage>) => {
    onChange(cleanImage({ ...DEFAULT_IMAGE, layer: image?.layer ?? DEFAULT_IMAGE.layer, ...p }));
    setOpen(false);
    setQ('');
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      pick({ src: await shrinkImage(f, 900, 0.72), bankId: null });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const results = searchPictures(q);

  return (
    <div className="flex flex-col gap-2">
      {image ? (
        <div className="flex items-start gap-[10px]">
          <div className="relative h-[84px] w-[84px] flex-none overflow-hidden rounded-md bg-neutral-800">
            <PictureFill image={image} fade={image.layer === 'behind'} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
            <div role="group" aria-label="Where the picture goes" className="flex gap-1">
              {LAYERS.map((l) => (
                <button
                  key={l.id}
                  aria-pressed={image.layer === l.id}
                  /* Going behind the words starts faded, so they stay readable. */
                  onClick={() => set({ layer: l.id, opacity: l.id === 'behind' && image.layer !== 'behind' && image.opacity === 100 ? 40 : image.opacity })}
                  className="min-h-11 flex-1 rounded-md border px-2 text-[12px] font-medium"
                  style={seg(image.layer === l.id)}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <div className="text-[10.5px] leading-[1.35] text-neutral-500">{LAYERS.find((l) => l.id === image.layer)?.hint}</div>
            <label className="text-[10.5px] text-neutral-500">
              Size
              <input type="range" min={50} max={160} step={5} value={image.scale} onChange={(e) => set({ scale: Number(e.target.value) })} className="block w-full" />
            </label>
            {image.src ? (
              <>
                <label className="text-[10.5px] text-neutral-500">
                  Left to right
                  <input type="range" min={0} max={100} value={image.posX} onChange={(e) => set({ posX: Number(e.target.value) })} className="block w-full" />
                </label>
                <label className="text-[10.5px] text-neutral-500">
                  Top to bottom
                  <input type="range" min={0} max={100} value={image.posY} onChange={(e) => set({ posY: Number(e.target.value) })} className="block w-full" />
                </label>
              </>
            ) : null}
            {image.layer === 'behind' ? (
              <label className="text-[10.5px] text-neutral-500">
                Fade, so the words stay readable
                <input type="range" min={20} max={100} step={5} value={image.opacity} onChange={(e) => set({ opacity: Number(e.target.value) })} className="block w-full" />
              </label>
            ) : null}
            <div className="flex gap-2">
              <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-h-11 rounded-md px-2 text-[12px] font-medium text-accent-300">
                Change picture
              </button>
              <button onClick={() => onChange(null)} className="min-h-11 rounded-md px-2 text-[12px] font-medium text-neutral-400">
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-11 items-center gap-[6px] self-start rounded-md px-1 text-[12.5px] font-medium text-accent-300">
          <Icon name="ph ph-image" className="text-[15px]" />
          Add a picture
        </button>
      )}
      {open ? (
        <div className="flex flex-col gap-2 rounded-md border border-neutral-800 p-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="Search: worship, sports, outdoors, logo…" aria-label="Search pictures" />
          {results.length ? (
            <div className="grid grid-cols-4 gap-[6px]">
              {results.map((b) => (
                <button key={b.id} onClick={() => pick({ bankId: b.id, src: null })} aria-label={b.label} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md p-1" style={{ background: b.color }}>
                  <Icon name={b.icon} className="text-[20px] text-white/85" />
                  <span className="text-center text-[9.5px] font-medium leading-[1.15] text-white/90">{b.label}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-1 py-2 text-[12px] text-neutral-500">No picture matches that. Try a plainer word — team, church, outdoors.</div>
          )}
          <label className="btn btn-ghost min-h-11 cursor-pointer justify-center">
            <Icon name="ph ph-upload-simple" className="mr-[6px] text-[14px]" />
            {busy ? 'Shrinking…' : 'Upload a photo'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          {err ? <div className="text-[12px] text-neutral-400">{err}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
