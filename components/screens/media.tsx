'use client';
/* MEDIA & FILM — every photo and clip lands in the week it happened in and
   stays there. Film opens the scoreboard camera; Capture files photos. */
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Recorder } from '@/components/media/recorder';
import { Sheet } from '@/components/sheet';
import { Btn, Icon, Screen, ScreenHeader } from '@/components/ui';
import { shrinkImage } from '@/lib/image';
import { delBlob, getBlob, putBlob, useFileUrl } from '@/lib/media-store';
import { canApprove } from '@/lib/permissions';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Clip, MediaItem } from '@/lib/types/model';

const KINDS = [
  { id: 'game', label: 'Game night' },
  { id: 'scripture', label: 'Recitation' },
  { id: 'chant', label: 'Team chant' },
  { id: 'mascot', label: 'Mascot story' },
  { id: 'commercial', label: 'Commercial' }
];

const sel = (on: boolean) => ({
  borderColor: on ? 'var(--color-accent-500)' : 'var(--color-neutral-800)',
  background: on ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
  color: on ? 'var(--color-accent-100)' : 'var(--color-neutral-400)'
});

export function MediaScreen() {
  const d = useApp((s) => s.data);
  const params = useSearchParams();
  const api = useAppApi();
  const [film, setFilm] = useState(params.get('record') === '1');
  const [capture, setCapture] = useState(false);
  const [photo, setPhoto] = useState<MediaItem | null>(null);
  const [clip, setClip] = useState<Clip | null>(null);
  const wk = d.config.weekNumber;

  const albums = (() => {
    const weeks = new Set<number>([wk]);
    for (const x of d.media) weeks.add(x.week);
    for (const c of d.clips) weeks.add(c.week);
    return [...weeks]
      .sort((a, b) => b - a)
      .map((w) => {
        const iso = d.config.meetingDates[w - 1];
        const date = iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
        return {
          week: w,
          title: 'Week ' + w + (w === wk ? ' · ' + (d.config.gameName || 'Game night') : ''),
          meta: w === wk ? 'tonight' : date,
          clips: d.clips.filter((c) => c.week === w),
          items: d.media.filter((x) => x.week === w).sort((a, b) => b.at - a.at)
        };
      })
      .filter((a) => a.week === wk || a.clips.length || a.items.length);
  })();

  return (
    <Screen label="Media & film">
      <ScreenHeader
        title="Media & Film"
        back="/dashboard/more"
        right={
          <div className="flex gap-2">
            <button onClick={() => setFilm(true)} className="flex min-h-11 items-center gap-[7px] rounded-full border border-neutral-800 px-[13px] text-[12.5px] font-semibold leading-none text-neutral-300">
              <Icon name="ph ph-video-camera" className="text-[15px]" />
              Film
            </button>
            <button onClick={() => setCapture(true)} className="flex min-h-11 items-center gap-[7px] rounded-full border border-accent-600 px-[14px] text-[12.5px] font-semibold leading-none text-accent-200" style={{ background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)' }}>
              <Icon name="ph ph-camera" className="text-[15px]" />
              Capture
            </button>
          </div>
        }
      />
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">Everything files into the week it happened in and stays there. Clips stay on the phone that filmed them until someone saves or shares them.</div>

      {d.filmMarks.length ? (
        <div className="sr-card overflow-hidden border border-accent-700">
          <div className="flex items-center gap-[9px] px-[15px] pb-[11px] pt-[13px]">
            <Icon name="ph-fill ph-push-pin" className="flex-none text-[16px] text-accent-300" />
            <div className="min-w-0 flex-1">
              <div className="text-[14px] font-medium leading-[1.2] text-neutral-100">Pinned, not yet filmed</div>
              <div className="mt-[3px] text-[11px] leading-[1.35] text-neutral-500 text-pretty">
                {d.filmMarks.length === 1 ? 'One moment' : d.filmMarks.length + ' moments'} pinned while the camera was off — notes for whoever cuts the recap.
              </div>
            </div>
          </div>
          {d.filmMarks.map((mk) => (
            <div key={mk.id} className="flex items-center gap-[11px] border-t border-divider px-[15px] py-[11px]">
              <div className="min-w-0 flex-1">
                <div className="tabular text-[12.5px] font-medium leading-[1.3] text-neutral-200">
                  {mk.clock} · {mk.period === 'OT' ? 'overtime' : 'period ' + mk.period}
                </div>
                <div className="mt-[2px] text-[10.5px] leading-[1.3] text-neutral-500">{new Date(mk.at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>
              </div>
              <button aria-label="Remove this pin" onClick={() => api().mutate((x) => void (x.filmMarks = x.filmMarks.filter((y) => y.id !== mk.id)))} className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border border-neutral-800 text-neutral-400">
                <Icon name="ph ph-x" className="text-[13px]" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {albums.map((a) => (
        <div key={a.week}>
          <div className="mb-[9px] mt-1 flex items-center gap-2">
            <div className="text-[14px] font-medium leading-none text-neutral-100">{a.title}</div>
            <div className="text-[11px] leading-none text-neutral-500">{a.meta}</div>
            <div className="ml-auto text-[11px] leading-none text-neutral-500">{a.clips.length + a.items.length} files</div>
          </div>
          <div className="grid grid-cols-3 gap-[7px]">
            {a.clips.map((c) => (
              <button key={c.id} onClick={() => setClip(c)} aria-label={'Play clip ' + c.line} className="flex aspect-square animate-[sr-rise_.25s_ease_both] flex-col items-center justify-center gap-[5px] overflow-hidden rounded-md bg-neutral-900" style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
                <Icon name="ph-fill ph-play-circle" className="text-[22px] text-accent-300" />
                <div className="tabular px-[6px] text-center text-[9.5px] leading-[1.2] text-neutral-400">{c.line || c.dur + 's clip'}</div>
              </button>
            ))}
            {a.items.map((x) => (
              <Tile key={x.id} item={x} onOpen={() => setPhoto(x)} />
            ))}
            {!a.clips.length && !a.items.length ? <div className="col-span-3 rounded-md border border-dashed border-neutral-800 px-3 py-5 text-center text-[11.5px] leading-[1.5] text-neutral-500">Nothing filed for this week yet. Capture a photo or film the game.</div> : null}
          </div>
        </div>
      ))}

      <CaptureSheet open={capture} onClose={() => setCapture(false)} />
      <PhotoViewer item={photo} onClose={() => setPhoto(null)} />
      <ClipViewer clip={clip} onClose={() => setClip(null)} />
      <Recorder open={film} onClose={() => setFilm(false)} />
    </Screen>
  );
}

function Tile({ item, onOpen }: { item: MediaItem; onOpen: () => void }) {
  const api = useAppApi();
  const url = useFileUrl(item.localKey, item.path, (p) => api().backend.fileUrl(p));
  const has = !!(item.localKey || item.path);
  const icon = item.kind === 'video' ? 'ph ph-video-camera' : item.kind === 'audio' ? 'ph ph-microphone' : 'ph ph-image';
  return (
    <div
      role={has ? 'button' : undefined}
      tabIndex={has ? 0 : undefined}
      onClick={has ? onOpen : undefined}
      onKeyDown={has ? (e) => (e.key === 'Enter' || e.key === ' ') && onOpen() : undefined}
      aria-label={item.label}
      className="flex aspect-square animate-[sr-rise_.25s_ease_both] flex-col items-center justify-center gap-[5px] overflow-hidden rounded-md bg-neutral-900 bg-cover bg-center"
      style={{ boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)', backgroundImage: url && item.kind === 'photo' ? 'url(' + url + ')' : undefined, cursor: has ? 'pointer' : 'default' }}
    >
      {!url || item.kind !== 'photo' ? (
        <>
          <Icon name={icon} className="text-[19px] text-neutral-500" />
          <div className="px-[6px] text-center text-[9.5px] leading-[1.2] text-neutral-500">{item.label}</div>
        </>
      ) : null}
    </div>
  );
}

function CaptureSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const [kind, setKind] = useState('game');
  const [week, setWeek] = useState(d.config.weekNumber);
  const [files, setFiles] = useState<{ id: string; blob: Blob; url: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    const next: { id: string; blob: Blob; url: string }[] = [];
    for (const f of Array.from(list)) {
      try {
        const data = await shrinkImage(f, 1600, 0.82);
        const blob = await (await fetch(data)).blob();
        next.push({ id: uid(), blob, url: URL.createObjectURL(blob) });
      } catch {
        api().say(f.name + ' isn’t an image this phone can read.');
      }
    }
    setFiles((x) => x.concat(next));
    setBusy(false);
  };

  const confirm = async () => {
    if (!files.length) {
      api().say('Take or pick a photo first.');
      return;
    }
    const label = KINDS.find((k) => k.id === kind)?.label ?? 'Photo';
    const items: MediaItem[] = [];
    for (const f of files) {
      const key = 'media:' + f.id;
      await putBlob(key, f.blob);
      items.push({ id: f.id, week, kind: 'photo', label, localKey: key, path: null, by: m.displayName, at: Date.now() });
    }
    api().mutate((x) => void x.media.push(...items));
    /* Supabase: each file uploads to the ministry's bucket so other phones see it. */
    if (api().backend.mode === 'supabase' && !api().offline()) {
      for (let i = 0; i < items.length; i++) {
        const path = api().membership.orgId + '/' + items[i].week + '/' + items[i].id;
        const it = { ...items[i], path };
        try {
          await api().backend.sync({ kind: 'media', item: it, file: files[i].blob });
          api().mutate((x) => {
            const r = x.media.find((y) => y.id === it.id);
            if (r) r.path = path;
          });
        } catch {
          api().say('Saved on this phone — the upload will need signal.');
        }
      }
    }
    api().logActivity(m.displayName + ' filed ' + items.length + (items.length === 1 ? ' photo' : ' photos') + ' into Week ' + week);
    api().say((items.length === 1 ? 'One photo' : items.length + ' photos') + ' filed into Week ' + week + '.');
    setFiles([]);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} label="Add to an album">
      <div className="text-[17px] font-medium leading-[1.2] text-neutral-100">Add to an album</div>
      <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void add(e.target.files).then(() => (e.target.value = ''))} />
      <input ref={lib} type="file" accept="image/*" multiple className="hidden" onChange={(e) => void add(e.target.files).then(() => (e.target.value = ''))} />
      <div className="flex gap-[9px]">
        <button onClick={() => cam.current?.click()} className="flex min-h-16 flex-1 flex-col items-center justify-center gap-[5px] rounded-lg border border-accent-600 text-[11.5px] font-medium leading-none text-accent-100" style={{ background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' }}>
          <Icon name={busy ? 'ph ph-circle-notch' : 'ph ph-camera'} className={'text-[19px]' + (busy ? ' animate-sr-spin' : '')} />
          Take a photo
        </button>
        <button onClick={() => lib.current?.click()} className="flex min-h-16 flex-1 flex-col items-center justify-center gap-[5px] rounded-lg border border-neutral-800 text-[11.5px] font-medium leading-none text-neutral-300">
          <Icon name="ph ph-image-square" className="text-[19px]" />
          From library
        </button>
      </div>
      {files.length ? (
        <div className="flex gap-[7px] overflow-auto pb-[2px]">
          {files.map((f) => (
            <div key={f.id} className="relative h-16 w-16 flex-none overflow-hidden rounded-md bg-cover bg-center" style={{ backgroundImage: 'url(' + f.url + ')', boxShadow: 'inset 0 0 0 1px var(--color-neutral-800)' }}>
              <button aria-label="Remove" onClick={() => setFiles((x) => x.filter((y) => y.id !== f.id))} className="absolute right-0 top-0 h-[30px] w-[30px] rounded-full bg-black/60 text-[10px] font-semibold text-white">
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">What is it</div>
        <div className="flex flex-wrap gap-[7px]">
          {KINDS.map((k) => (
            <button key={k.id} onClick={() => setKind(k.id)} aria-pressed={kind === k.id} className="min-h-11 rounded-full border px-[13px] text-[12px] font-medium leading-none" style={sel(kind === k.id)}>
              {k.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[10px] font-semibold uppercase leading-none tracking-[.12em] text-neutral-500">Which week</div>
        <div className="flex max-h-24 flex-wrap gap-[7px] overflow-auto">
          {Array.from({ length: d.config.seasonWeeks }, (_, i) => d.config.seasonWeeks - i).map((w) => (
            <button key={w} onClick={() => setWeek(w)} aria-pressed={week === w} className="min-h-11 min-w-16 flex-[1_0_auto] rounded-md border text-[12px] font-medium leading-none" style={sel(week === w)}>
              Week {w}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-[2px] flex gap-[9px]">
        <Btn variant="secondary" className="min-h-12 flex-1 justify-center" onClick={onClose}>
          Cancel
        </Btn>
        <Btn className="min-h-12 flex-[2] justify-center" onClick={() => void confirm()}>
          {(files.length ? files.length + ' to ' : 'Add to ') + 'Week ' + week}
        </Btn>
      </div>
    </Sheet>
  );
}

function PhotoViewer({ item, onClose }: { item: MediaItem | null; onClose: () => void }) {
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const url = useFileUrl(item?.localKey, item?.path, (p) => api().backend.fileUrl(p));
  const canRemove = !!item && (canApprove(m.persona) || item.by === m.displayName);
  return (
    <Sheet open={!!item} onClose={onClose} label="Photo" z={92} maxH="92%">
      <div className="text-[15px] font-medium leading-[1.2] text-neutral-100">
        {item?.label} · Week {item?.week}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL or a signed URL */}
      {url ? <img src={url} alt={item?.label ?? 'Photo'} className="w-full rounded-md" /> : <div className="sr-shimmer h-48 rounded-md" />}
      {item?.by ? <div className="text-[11px] leading-none text-neutral-500">Added by {item.by}</div> : null}
      <div className="flex gap-2">
        {url ? (
          <Btn variant="secondary" className="flex-1 justify-center" href={url} download={'squadrise-week' + item?.week + '.jpg'}>
            Save
          </Btn>
        ) : null}
        {canRemove ? (
          <Btn
            variant="ghost"
            className="flex-1 justify-center"
            onClick={() => {
              if (!item || !window.confirm('Remove this photo from the album?')) return;
              api().mutate((x) => void (x.media = x.media.filter((y) => y.id !== item.id)));
              if (item.localKey) void delBlob(item.localKey);
              api().emit({ kind: 'mediaRemove', id: item.id, path: item.path ?? null });
              onClose();
            }}
          >
            Remove
          </Btn>
        ) : null}
      </div>
    </Sheet>
  );
}

function ClipViewer({ clip, onClose }: { clip: Clip | null; onClose: () => void }) {
  const api = useAppApi();
  const url = useFileUrl(clip?.localKey, null, async () => null);
  const ext = clip?.mime.includes('mp4') ? 'mp4' : 'webm';
  const name = 'squadrise-week' + clip?.week + '-' + (clip?.line || 'clip').replace(/[^A-Za-z0-9]+/g, '-') + '.' + ext;
  const vref = useRef<HTMLVideoElement>(null);

  const share = async () => {
    if (!clip) return;
    const b = await getBlob(clip.localKey);
    if (!b) return api().say('That clip is no longer on this phone.');
    const file = new File([b], name, { type: b.type });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: clip.line });
      } catch {
        /* closed */
      }
    } else {
      api().say('Sharing files isn’t supported here — use Save.');
    }
  };

  return (
    <Sheet open={!!clip} onClose={onClose} label="Clip" z={92} maxH="92%">
      <div className="text-[15px] font-medium leading-[1.2] text-neutral-100">{clip?.line || 'Clip'}</div>
      {url ? <video ref={vref} src={url} controls playsInline className="w-full rounded-md bg-black" /> : <div className="sr-shimmer aspect-video rounded-md" />}
      {clip?.pins.length ? (
        <div className="flex flex-wrap gap-[6px]">
          {clip.pins.map((p, i) => (
            <button
              key={i}
              onClick={() => {
                if (vref.current) {
                  vref.current.currentTime = p;
                  void vref.current.play();
                }
              }}
              className="min-h-11 rounded-full border border-accent-700 px-3 text-[11.5px] font-medium leading-none text-accent-200"
            >
              <Icon name="ph-fill ph-push-pin" className="mr-[5px] text-[11px]" />
              {Math.floor(p / 60) + ':' + String(p % 60).padStart(2, '0')}
            </button>
          ))}
        </div>
      ) : null}
      <div className="text-[11px] leading-[1.5] text-neutral-500">
        {clip?.dur}s · {clip?.mb} MB · only on this phone — save or share it to keep a copy.
      </div>
      <div className="flex gap-2">
        {url ? (
          <Btn className="flex-1 justify-center" href={url} download={name}>
            Save
          </Btn>
        ) : null}
        <Btn variant="secondary" className="flex-1 justify-center" onClick={() => void share()}>
          Share
        </Btn>
        <Btn
          variant="ghost"
          className="flex-1 justify-center"
          onClick={() => {
            if (!clip || !window.confirm('Delete this clip? It has not been uploaded anywhere — once it is gone there is no getting it back.')) return;
            void delBlob(clip.localKey);
            api().mutate((x) => void (x.clips = x.clips.filter((y) => y.id !== clip.id)));
            onClose();
          }}
        >
          Delete
        </Btn>
      </div>
    </Sheet>
  );
}
