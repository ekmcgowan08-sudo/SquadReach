'use client';
/* CONSOLE · MEDIA — game film, and the spots a night plays or films:
   mascot bits, commercials, hype videos, whatever the ministry calls
   them. Each spot runs all season or in the weeks picked; the season plan
   and the phone's Media screen show the spots for each week. */
import { weeksLabel } from '@/components/console/challenges-tab';
import { Blur, Field, Section, useSaveConfig } from '@/components/console/kit';
import { Btn, Icon, Switch2, cx } from '@/components/ui';
import { uid } from '@/lib/store/app-store';
import { useApp } from '@/lib/store/provider';
import { FILM_DEFAULTS, type MediaAlbum, type MediaSpot } from '@/lib/types/model';

const SPOT_COLORS = ['#e0a23f', '#5a9fd6', '#74b37a', '#968ae0', '#d9708c', '#4fb3a9'];

export function MediaTab() {
  const c = useApp((s) => s.data.config);
  const save = useSaveConfig();
  const film = { ...FILM_DEFAULTS, ...c.filmUpload };
  const spots = c.mediaSpots ?? [];
  const weeks = Array.from({ length: c.seasonWeeks }, (_, i) => i + 1);
  const albums = [...(c.mediaAlbums ?? [])].sort((a, b) => b.week - a.week);
  const setAlbum = (week: number, a: MediaAlbum | null, note?: string) =>
    save((cc) => ({ mediaAlbums: [...(cc.mediaAlbums ?? []).filter((x) => x.week !== week), ...(a ? [a] : [])].sort((x, y) => x.week - y.week) }), note);
  const nameNext = () => {
    const taken = new Set(albums.map((a) => a.week));
    const w = [c.weekNumber, ...weeks.filter((x) => x > c.weekNumber), ...weeks].find((x) => !taken.has(x));
    if (!w) return;
    setAlbum(w, { week: w, title: 'Photos', note: '', color: SPOT_COLORS[albums.length % SPOT_COLORS.length] }, 'Named the week ' + w + ' album');
  };
  const setSpot = (sp: MediaSpot, note?: string) => save((cc) => ({ mediaSpots: (cc.mediaSpots ?? []).some((x) => x.id === sp.id) ? (cc.mediaSpots ?? []).map((x) => (x.id === sp.id ? sp : x)) : [...(cc.mediaSpots ?? []), sp] }), note);
  const toggleWeek = (sp: MediaSpot, w: number) => {
    const on = new Set(sp.weeks ?? weeks);
    if (on.has(w)) on.delete(w);
    else on.add(w);
    setSpot({ ...sp, weeks: on.size === weeks.length ? null : [...on].sort((a, b) => a - b) });
  };

  return (
    <div className="flex flex-col gap-5">
      <Section title="Game film" sub="Clips are filmed on a phone and stay there unless someone adds one to the week album. Turn this on to allow that. Uploaded film takes storage space, so it has a size limit and leaves the album after a set time; the copy on the phone that filmed it isn’t touched.">
        <div className="grid items-start gap-3 sm:grid-cols-3">
          <div className="field">
            <span className="sr-label" aria-hidden="true">Clips in the album</span>
            <Switch2 label="Clips in the album" value={film.on ? 'on' : 'off'} options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'Allowed' }]} onChange={(v) => save({ filmUpload: { ...film, on: v === 'on' } }, v === 'on' ? 'Allowed game film in the album' : 'Stopped new game film in the album')} />
          </div>
          <Field label="Largest clip (MB)" type="number" value={film.maxMb} onSave={(v) => save({ filmUpload: { ...film, maxMb: Math.max(5, Math.min(500, Number(v) || FILM_DEFAULTS.maxMb)) } })} />
          <Field label="Keep for (days)" type="number" value={film.keepDays} onSave={(v) => save({ filmUpload: { ...film, keepDays: Math.max(1, Math.min(365, Number(v) || FILM_DEFAULTS.keepDays)) } })} hint="Then it leaves the album for good." />
        </div>
      </Section>

      <Section
        title="Albums"
        sub="Every week has an album already. Name one and leave a note for whoever’s capturing — “Capture Cup finals + awards” — and the phone’s Media screen shows both."
        right={
          <Btn className="px-4" onClick={nameNext} disabled={albums.length >= weeks.length}>
            <Icon name="ph ph-plus" className="mr-[6px] text-[14px]" />
            Name an album
          </Btn>
        }
      >
        {!albums.length ? <p className="text-[13px] text-neutral-500">No named albums yet — each week shows as “Week N”.</p> : null}
        {albums.map((a) => (
          <div key={a.week} className="flex flex-wrap items-center gap-2 rounded-md border border-neutral-800 px-4 py-3" role="group" aria-label={'Album: ' + a.title}>
            <button
              aria-label={'Change the colour of ' + a.title}
              title="Change colour"
              onClick={() => setAlbum(a.week, { ...a, color: SPOT_COLORS[(SPOT_COLORS.indexOf(a.color) + 1) % SPOT_COLORS.length] })}
              className="flex h-11 w-8 flex-none items-center justify-center"
            >
              <span className="h-5 w-5 rounded" style={{ background: a.color }} />
            </button>
            <label className="field w-[110px]">
              <span className="sr-label">Week</span>
              <select
                className="input"
                value={a.week}
                onChange={(e) => {
                  const w = Number(e.target.value);
                  if (albums.some((x) => x.week === w)) return;
                  save((cc) => ({ mediaAlbums: (cc.mediaAlbums ?? []).map((x) => (x.week === a.week ? { ...x, week: w } : x)) }));
                }}
              >
                {weeks.map((w) => (
                  <option key={w} value={w} disabled={w !== a.week && albums.some((x) => x.week === w)}>
                    Week {w}
                  </option>
                ))}
              </select>
            </label>
            <Blur label="Title" value={a.title} onSave={(v) => v && setAlbum(a.week, { ...a, title: v }, 'Renamed the week ' + a.week + ' album to ' + v)} className="min-w-[160px] flex-1" />
            <Blur label="Note for whoever’s capturing" value={a.note} onSave={(v) => setAlbum(a.week, { ...a, note: v })} className="min-w-[200px] flex-1" />
            <button
              aria-label={'Take the name off ' + a.title}
              onClick={() => setAlbum(a.week, null, 'Took the name off the week ' + a.week + ' album')}
              className="flex h-11 w-11 flex-none items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-neutral-200"
            >
              <Icon name="ph ph-x" className="text-[15px]" />
            </button>
          </div>
        ))}
      </Section>

      <Section
        title="Media spots"
        sub="Mascot bits, commercials, hype videos: any kind of spot. Name the type yourself and add as many as the night needs. The season plan and the phone’s Media screen show each week’s spots."
        right={
          <Btn className="px-4" onClick={() => setSpot({ id: uid(), kind: 'New spot', title: 'Untitled', note: '', color: SPOT_COLORS[spots.length % SPOT_COLORS.length] }, 'Added a media spot')}>
            <Icon name="ph ph-plus" className="mr-[6px] text-[14px]" />
            Add spot
          </Btn>
        }
      >
        {!spots.length ? <p className="text-[13px] text-neutral-500">No spots yet.</p> : null}
        {spots.map((sp) => (
          <div key={sp.id} className="flex flex-col gap-2 rounded-md border border-neutral-800 px-4 py-3" role="group" aria-label={'Spot: ' + sp.title}>
            <div className="flex flex-wrap items-center gap-2">
              <button
                aria-label={'Change the colour of ' + sp.title}
                title="Change colour"
                onClick={() => setSpot({ ...sp, color: SPOT_COLORS[(SPOT_COLORS.indexOf(sp.color) + 1) % SPOT_COLORS.length] })}
                className="flex h-11 w-8 flex-none items-center justify-center"
              >
                <span className="h-5 w-5 rounded" style={{ background: sp.color }} />
              </button>
              <Blur label="Type" value={sp.kind} onSave={(v) => v && setSpot({ ...sp, kind: v })} className="w-[150px]" />
              <Blur label="Title" value={sp.title} onSave={(v) => v && setSpot({ ...sp, title: v }, 'Renamed a spot to ' + v)} className="min-w-[160px] flex-1" />
              <Blur label="When it plays" value={sp.note} onSave={(v) => setSpot({ ...sp, note: v })} className="min-w-[180px] flex-1" />
              <button
                aria-label={'Remove ' + sp.title}
                onClick={() => window.confirm('Remove “' + sp.title + '”?') && save((cc) => ({ mediaSpots: (cc.mediaSpots ?? []).filter((x) => x.id !== sp.id) }), 'Removed the spot ' + sp.title)}
                className="flex h-11 w-11 flex-none items-center justify-center rounded-md border border-neutral-800 text-neutral-500 hover:text-neutral-200"
              >
                <Icon name="ph ph-trash" className="text-[15px]" />
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-[6px]">
              <span className="mr-1 text-[12px] text-neutral-400">Runs: {weeksLabel(sp.weeks)}</span>
              <button onClick={() => setSpot({ ...sp, weeks: null })} aria-pressed={!sp.weeks} className={cx('min-h-8 rounded-md border px-3 text-[12px]', !sp.weeks ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                All
              </button>
              <button onClick={() => setSpot({ ...sp, weeks: [] })} aria-pressed={!!sp.weeks && !sp.weeks.length} className={cx('min-h-8 rounded-md border px-3 text-[12px]', sp.weeks && !sp.weeks.length ? 'border-accent-500 text-accent-100' : 'border-neutral-800 text-neutral-400')}>
                None
              </button>
              {weeks.map((w) => {
                const on = !sp.weeks || sp.weeks.includes(w);
                return (
                  <button key={w} onClick={() => toggleWeek(sp, w)} aria-pressed={on} aria-label={sp.title + ', week ' + w} className={cx('min-h-8 min-w-8 rounded-md border px-2 text-[12px] tabular-nums', on ? 'border-accent-600 text-accent-100' : 'border-neutral-800 text-neutral-500', w === c.weekNumber && 'font-semibold')}>
                    {w}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}
