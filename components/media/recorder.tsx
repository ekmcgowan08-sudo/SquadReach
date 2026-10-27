'use client';
/* FILM — the phone's camera with the scoreboard burned in.

   A canvas draws each camera frame and the scorebug on top; MediaRecorder
   records the canvas (plus the mic), so the clip a student shares already
   has the score on it. Tapping a squad while filming is a real award() in
   app mode — the overlay, the standings and the audit line move from one
   thumb. Clips stay on this phone until someone saves or shares them.

   The layout follows the overlay's own width (a container query), so a
   phone turned sideways gets the side rail and a desk browser gets it too. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/components/ui';
import { nowMs } from '@/lib/dates';
import { advanceBracket, bracketSeeds, bracketWinPayable, settleFromClip } from '@/lib/feeds';
import { bracketOf } from '@/lib/game';
import { formatOf, periodKeys, periodName } from '@/lib/game-format';
import { putBlob } from '@/lib/media-store';
import { canScore } from '@/lib/permissions';
import { fmt, pointBase } from '@/lib/scoring';
import { uid } from '@/lib/store/app-store';
import { useApp, useAppApi } from '@/lib/store/provider';
import type { Team } from '@/lib/types/model';
import { useNow } from '@/lib/use-now';
import { useOverlayHost } from '@/lib/use-overlay-host';
import { abbr, drawScorebug, overlayOf } from '@/lib/scorebug';

const W = 1280;
const H = 720;
const LOOKBACK = 30;

const clockText = (sec: number) => {
  const t = Math.max(0, Math.floor(sec));
  return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
};

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of ['video/mp4;codecs=avc1,mp4a', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

interface Clock {
  base: number;
  startedAt: number | null;
  mode: 'up' | 'down';
  target: number;
}
const clockSec = (c: Clock, now: number) => {
  const ran = c.base + (c.startedAt != null ? (now - c.startedAt) / 1000 : 0);
  return c.mode === 'down' ? Math.max(0, c.target - ran) : ran;
};

export function Recorder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useApp((s) => s.data);
  const m = useApp((s) => s.membership);
  const api = useAppApi();
  const scorer = canScore(m.persona);
  const host = useOverlayHost();
  const [panel, setPanel] = useState<'score' | 'setup' | 'clips'>('score');
  const [floor, setFloor] = useState<string[]>(() => d.teams.slice(0, 2).map((t) => t.id));
  const [tally, setTally] = useState<Record<string, number>>({});
  const [lastTap, setLastTap] = useState<{ team: string; val: number; awarded: boolean } | null>(null);
  const [source, setSource] = useState<'app' | 'tally'>(scorer ? 'app' : 'tally');
  const fmtGame = d.config.gameSetup.format;
  const [clock, setClock] = useState<Clock>(() => {
    const f = formatOf(fmtGame);
    return f.ends === 'clock' ? { base: 0, startedAt: null, mode: 'down', target: f.minutes * 60 } : { base: 0, startedAt: null, mode: 'up', target: 600 };
  });
  const [period, setPeriod] = useState('1');
  const [overlayOn, setOverlayOn] = useState(true);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [micOn, setMicOn] = useState(true);
  const [camErr, setCamErr] = useState('');
  const [rec, setRec] = useState<{ startedAt: number; pins: number[] } | null>(null);
  const [lastEvent, setLastEvent] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const pinsRef = useRef<number[]>([]);
  const overlay = useMemo(() => overlayOf(d.config.overlay), [d.config.overlay]);
  const drawState = useRef({ teams: [] as Team[], tally: {} as Record<string, number>, clock, period, periodName: '', overlayOn, brand: d.config.ministryName, week: d.config.weekNumber, last: '', overlay, recording: false });

  const teams = useMemo(() => d.teams.filter((t) => floor.includes(t.id)), [d.teams, floor]);
  const goal = d.config.goalValue || 25;
  const now = useNow(open && (clock.startedAt != null || !!rec), 250);

  useEffect(() => {
    drawState.current = { teams, tally, clock, period, periodName: periodName(fmtGame, period).toUpperCase(), overlayOn, brand: d.config.ministryName, week: d.config.weekNumber, last: lastEvent, overlay, recording: !!rec };
  }, [teams, tally, clock, period, fmtGame, overlayOn, d.config.ministryName, d.config.weekNumber, lastEvent, overlay, rec]);

  /* Camera: ask once per open (and again when flipped). Without one the
     scoreboard still records over a plain backdrop. */
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamErr('This browser can’t open the camera — you can still record the scoreboard.');
        return;
      }
      try {
        let s: MediaStream;
        try {
          s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
        } catch {
          s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing }, audio: false });
        }
        if (!alive) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = s;
        s.getAudioTracks().forEach((t) => (t.enabled = micOn));
        const v = videoRef.current;
        if (v) {
          v.srcObject = s;
          await v.play().catch(() => undefined);
        }
        setCamErr('');
      } catch {
        if (alive) setCamErr('Camera is blocked or busy — allow it in your browser settings. The scoreboard still records.');
      }
    })();
    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the mic toggle flips the track, it doesn't reopen the camera
  }, [open, facing]);

  /* The draw loop: camera frame (cover-fit), then the scorebug. */
  useEffect(() => {
    if (!open) return;
    let raf = 0;
    const tick = () => {
      const cv = canvasRef.current;
      const ctx = cv?.getContext('2d');
      const v = videoRef.current;
      if (cv && ctx) {
        const st = drawState.current;
        if (v && v.readyState >= 2 && v.videoWidth) {
          const s = Math.max(W / v.videoWidth, H / v.videoHeight);
          const w = v.videoWidth * s;
          const h = v.videoHeight * s;
          ctx.drawImage(v, (W - w) / 2, (H - h) / 2, w, h);
        } else {
          const g = ctx.createLinearGradient(0, 0, W, H);
          g.addColorStop(0, '#1d2040');
          g.addColorStop(1, '#0d0f18');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, W, H);
        }
        /* brand mark, top right */
        ctx.font = '700 22px Inter, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(233,233,237,.55)';
        ctx.fillText('SQUAD', W - 96, 44);
        ctx.fillStyle = 'rgba(181,171,252,.8)';
        ctx.fillText('RISE', W - 40, 44);
        ctx.textAlign = 'left';
        if (st.overlayOn) drawScorebug(ctx, W, H, { teams: st.teams, tally: st.tally, clock: clockText(clockSec(st.clock, Date.now())), period: st.period, periodName: st.periodName, brand: st.brand, week: st.week, last: / scores/.test(st.last) ? st.last : '' }, st.overlay);
        if (st.recording) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(44, 44, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const stopRecording = useCallback(() => {
    const r = recRef.current;
    if (r && r.state !== 'inactive') r.stop();
  }, []);

  const startRecording = () => {
    const cv = canvasRef.current;
    if (!cv || typeof MediaRecorder === 'undefined' || !cv.captureStream) {
      api().say('This browser can’t record video. Try Chrome or Safari on a phone.');
      return;
    }
    const out = cv.captureStream(30);
    const audio = streamRef.current?.getAudioTracks()[0];
    if (audio) out.addTrack(audio);
    const mime = pickMime();
    let r: MediaRecorder;
    try {
      r = new MediaRecorder(out, mime ? { mimeType: mime, videoBitsPerSecond: 2_500_000 } : undefined);
    } catch {
      api().say('Recording failed to start on this browser.');
      return;
    }
    chunks.current = [];
    const startedAt = nowMs();
    const playing = [...floor];
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const blob = new Blob(chunks.current, { type: r.mimeType || mime || 'video/webm' });
      const dur = Math.round((Date.now() - startedAt) / 1000);
      const pins = pinsRef.current;
      setRec(null);
      void fileClip(blob, dur, pins, playing);
    };
    r.start(1000);
    recRef.current = r;
    pinsRef.current = [];
    setRec({ startedAt, pins: [] });
    setLastEvent('Recording');
  };

  const fileClip = async (blob: Blob, dur: number, pins: number[], playing: string[]) => {
    const id = uid();
    const key = 'clip:' + id;
    const s = api();
    const line = s.data.teams
      .filter((t) => playing.includes(t.id))
      .map((t) => abbr(t.name) + ' ' + (drawState.current.tally[t.id] ?? 0))
      .join(' · ');
    try {
      await putBlob(key, blob);
    } catch {
      s.say('This phone is out of room for the clip — free some space and film again.');
      return;
    }
    s.mutate((x) => {
      x.clips.unshift({ id, localKey: key, mime: blob.type, dur, at: Date.now(), line, mb: Math.round((blob.size / 1_048_576) * 10) / 10, week: x.config.weekNumber, pins });
    });
    /* Stop filming → the bracket game settles itself, paying once. */
    let extra = '';
    const data = s.data;
    const br = bracketOf(data.game);
    if (br.enabled) {
      const res = settleFromClip(data.teams, data.ledger, br, playing, drawState.current.tally);
      if (res && bracketWinPayable(br, res.matchKey, res.winner)) {
        const amt = pointBase(data.config);
        s.award({ team: res.winner, cat: 'games', amount: amt, why: 'won a bracket game · from the filmed game', by: 'Tournament' });
        const { next } = advanceBracket(br, bracketSeeds(data.teams, data.ledger, br), res.matchKey, res.winner);
        s.mutate((x) => void (x.game.bracket = next));
        s.emit({ kind: 'game', game: api().data.game });
        const name = data.teams.find((t) => t.id === res.winner)?.name ?? '';
        s.logActivity('Bracket: ' + name + ' advances — from the filmed game');
        extra = ' · ' + name + ' advances in the bracket';
      }
    }
    s.logActivity('Filmed a ' + dur + 's clip — ' + line);
    s.say('Clip saved to Week ' + data.config.weekNumber + extra + '.');
    setLastEvent('Clip saved · ' + dur + 's');
  };

  useEffect(() => () => stopRecording(), [stopRecording]);

  const tap = (teamId: string, sign: 1 | -1 = 1) => {
    const name = d.teams.find((t) => t.id === teamId)?.name ?? '';
    if (sign < 0) {
      setTally((x) => ({ ...x, [teamId]: Math.max(0, (x[teamId] ?? 0) - 1) }));
      return;
    }
    setTally((x) => ({ ...x, [teamId]: (x[teamId] ?? 0) + 1 }));
    let awarded = false;
    if (source === 'app') {
      awarded = !!api().award({ team: teamId, cat: 'games', amount: goal, why: name + ' scored — tapped while filming' });
    }
    setLastTap({ team: teamId, val: goal, awarded });
    setLastEvent(name + ' scores' + (awarded ? ' · +' + fmt(goal) : ''));
  };
  const undo = () => {
    if (!lastTap) return;
    setTally((x) => ({ ...x, [lastTap.team]: Math.max(0, (x[lastTap.team] ?? 0) - 1) }));
    if (lastTap.awarded) api().award({ team: lastTap.team, cat: 'games', amount: -lastTap.val, why: 'Undid a tap on the filming screen' });
    setLastEvent('Undid the last tap');
    setLastTap(null);
  };
  const pin = () => {
    if (rec) {
      const at = Math.max(0, Math.round((Date.now() - rec.startedAt) / 1000) - LOOKBACK);
      pinsRef.current = [...pinsRef.current, at];
      setRec({ ...rec, pins: pinsRef.current });
      setLastEvent('Highlight pinned · ' + LOOKBACK + 's back');
      api().say('Pinned — the last ' + LOOKBACK + ' seconds are marked on this clip.');
      return;
    }
    const c = clockText(clockSec(clock, Date.now()));
    api().mutate((x) => {
      x.filmMarks.unshift({ id: uid(), clock: c, period, at: Date.now() });
    });
    setLastEvent('Pinned at ' + c + ' — camera was off');
    api().say('Pinned at ' + c + '. Nothing was filming, so it’s saved as a note on Media.');
  };
  const toggleClock = () =>
    setClock((c) => (c.startedAt != null ? { ...c, base: c.base + (Date.now() - c.startedAt) / 1000, startedAt: null } : { ...c, startedAt: Date.now() }));
  /* A whistle beat you: shift the clock a second without stopping it. */
  const nudge = (dsec: number) =>
    setClock((c) => {
      const running = c.startedAt != null;
      let base = c.base + (running ? (Date.now() - c.startedAt!) / 1000 : 0);
      base = Math.max(0, base + (c.mode === 'down' ? -dsec : dsec));
      return running ? { ...c, base, startedAt: Date.now() } : { ...c, base };
    });

  const close = () => {
    if (rec) stopRecording();
    onClose();
  };

  if (!open || !host) return null;
  const sec = clockSec(clock, now);
  const recLabel = rec ? clockText((now - rec.startedAt) / 1000) : '';
  const dark = 'rgba(233,233,237,';

  return createPortal(
    <div className="sr-dark @container absolute inset-0 z-[95] flex flex-col overflow-hidden bg-[#111214] text-[#e9e9ed]" role="dialog" aria-label="Film with the scoreboard">
      <video ref={videoRef} playsInline muted className="pointer-events-none absolute left-0 top-0 h-[2px] w-[2px] opacity-0" />
      <div className="flex min-h-0 flex-1 flex-col @min-[640px]:flex-row">
        {/* the rail: record, preview, pin, mic, tap deck */}
        <div className="flex flex-none flex-col gap-2 border-b border-white/10 bg-[#0d0e10] p-[10px] @min-[640px]:w-[300px] @min-[640px]:border-b-0 @min-[640px]:border-r">
          <div className="flex gap-2">
            <button aria-label="Close" onClick={close} className="flex h-11 w-11 flex-none items-center justify-center rounded-lg border" style={{ borderColor: dark + '.22)' }}>
              <Icon name="ph ph-x" className="text-[15px]" />
            </button>
            <button onClick={rec ? stopRecording : startRecording} className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-lg border" style={{ borderColor: dark + '.22)' }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-[5px]" style={{ background: rec ? '#ef4444' : '#3f424d' }}>
                <Icon name={rec ? 'ph-fill ph-stop' : 'ph-fill ph-record'} className="text-[10px] text-white" />
              </span>
              <span className="text-[12px] font-medium leading-none">{rec ? 'Stop · ' + recLabel : 'Record'}</span>
            </button>
            <button onClick={() => setOverlayOn((v) => !v)} aria-pressed={overlayOn} className="flex min-h-11 flex-1 items-center justify-center gap-[7px] rounded-lg border" style={{ borderColor: dark + '.22)' }}>
              <span className="flex h-5 w-5 items-center justify-center rounded-[5px]" style={{ background: overlayOn ? 'var(--color-accent)' : '#3f424d' }}>
                <Icon name="ph-fill ph-broadcast" className="text-[10px] text-white" />
              </span>
              <span className="text-[12px] font-medium leading-none">Scorebug</span>
            </button>
          </div>
          <div className="relative aspect-video overflow-hidden rounded bg-black">
            <canvas ref={canvasRef} width={W} height={H} className="block h-full w-full" />
            {rec ? (
              <div className="absolute left-[6px] top-[6px] flex items-center gap-[5px] rounded-full px-[7px] py-[3px]" style={{ background: 'rgba(8,9,16,.72)' }}>
                <span className="h-[6px] w-[6px] animate-sr-pulse rounded-full bg-accent" />
                <span className="text-[8.5px] font-semibold leading-none tracking-[.09em]">REC {recLabel}</span>
              </div>
            ) : null}
          </div>
          {camErr ? <div className="text-[10.5px] leading-[1.4]" style={{ color: dark + '.6)' }}>{camErr}</div> : null}
          <div className="flex gap-2">
            <div className="flex min-h-[52px] flex-1 items-center justify-center rounded-lg border p-2" style={{ borderColor: dark + '.12)' }}>
              <div className="truncate text-[11px] leading-[1.3]" style={{ color: dark + '.55)' }}>
                {lastEvent || (source === 'app' ? 'Taps post ' + fmt(goal) + ' to Games' : 'Taps keep an on-screen tally')}
              </div>
            </div>
            <button aria-label={'Pin a highlight, ' + LOOKBACK + ' seconds back'} onClick={pin} className="flex min-h-[52px] w-[82px] flex-none flex-col items-center justify-center gap-[3px] rounded-lg border" style={{ borderColor: dark + '.12)' }}>
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-accent">
                <Icon name="ph-fill ph-push-pin" className="text-[13px] text-white" />
              </span>
              <span className="text-[8.5px] font-medium uppercase leading-none tracking-[.06em]" style={{ color: dark + '.55)' }}>
                Pin {LOOKBACK}s
              </span>
            </button>
            <button
              role="switch"
              aria-label="Microphone"
              aria-checked={micOn}
              onClick={() => {
                const on = !micOn;
                setMicOn(on);
                streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = on));
                api().say(on ? 'Mic on — clips record the gym.' : 'Mic off — clips record silent.');
              }}
              className="flex min-h-[52px] w-[52px] flex-none items-center justify-center rounded-lg border"
              style={{ borderColor: micOn ? 'var(--color-accent-500)' : dark + '.12)', color: micOn ? 'var(--color-accent-200)' : dark + '.5)' }}
            >
              <Icon name={micOn ? 'ph-fill ph-microphone' : 'ph ph-microphone-slash'} className="text-[17px]" />
            </button>
          </div>
          {/* the tap deck */}
          <div className="flex items-end justify-between gap-[6px] pb-[2px] pt-1">
            {teams.slice(0, 4).map((t) => (
              <div key={t.id} className="flex min-w-0 flex-1 flex-col items-center gap-[5px]">
                <div className="tabular text-[17px] font-semibold leading-none">{tally[t.id] ?? 0}</div>
                <button aria-label={t.name + ' scores'} onClick={() => tap(t.id)} className="flex h-12 w-12 items-center justify-center rounded-full text-white" style={{ background: t.color }}>
                  <Icon name="ph ph-plus" className="text-[17px]" />
                </button>
                <div className="max-w-full truncate text-[9.5px] uppercase leading-none tracking-[.08em]" style={{ color: dark + '.6)' }}>
                  {abbr(t.name)}
                </div>
              </div>
            ))}
            <div className="flex w-[118px] flex-none flex-col items-center gap-[5px]">
              <div className="tabular text-[15px] font-semibold leading-none">{clockText(sec)}</div>
              <div className="flex items-center gap-[5px]">
                <button aria-label="Take a second off the clock" onClick={() => nudge(-1)} className="min-h-11 rounded-full border px-2 text-[11px]" style={{ borderColor: dark + '.2)' }}>
                  −1
                </button>
                <button aria-label={clock.startedAt != null ? 'Pause the clock' : 'Start the clock'} aria-pressed={clock.startedAt != null} onClick={toggleClock} className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white">
                  <Icon name={clock.startedAt != null ? 'ph-fill ph-pause' : 'ph-fill ph-play'} className="text-[15px]" />
                </button>
                <button aria-label="Add a second to the clock" onClick={() => nudge(1)} className="min-h-11 rounded-full border px-2 text-[11px]" style={{ borderColor: dark + '.2)' }}>
                  +1
                </button>
              </div>
              {lastTap ? (
                <button onClick={undo} className="relative min-h-5 rounded-full border px-[7px] text-[8.5px] font-medium before:absolute before:inset-x-0 before:-inset-y-3 before:content-['']" style={{ borderColor: dark + '.24)', color: dark + '.7)' }}>
                  Undo
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* the panel: score / setup / clips */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[10px] overflow-auto px-[18px] py-[14px]">
          <div className="flex gap-[6px]">
            {(['score', 'setup', 'clips'] as const).map((p) => (
              <button key={p} onClick={() => setPanel(p)} aria-pressed={panel === p} className="min-h-11 flex-1 rounded-lg border text-[12px] font-medium capitalize leading-none" style={{ borderColor: panel === p ? 'var(--color-accent-500)' : dark + '.14)', background: panel === p ? 'color-mix(in srgb, var(--color-accent) 18%, transparent)' : 'transparent' }}>
                {p === 'clips' ? 'Clips · ' + d.clips.filter((c) => c.week === d.config.weekNumber).length : p}
              </button>
            ))}
          </div>

          {panel === 'score' ? (
            <>
              <div className="text-[12px] leading-[1.5] text-pretty" style={{ color: dark + '.6)' }}>
                {source === 'app' ? 'Each tap posts ' + fmt(goal) + ' Games points for that squad — the board moves live. Undo takes the last one back.' : 'Taps only move the on-screen tally. Save it to Games when the game ends.'}
              </div>
              <div className="flex flex-wrap items-start justify-center gap-[10px]">
                {teams.map((t) => (
                  <div key={t.id} className="flex min-w-[92px] flex-1 flex-col items-center gap-[6px]">
                    <div className="max-w-full truncate text-[12px] leading-none tracking-[.03em]" style={{ color: dark + '.8)' }}>
                      {t.name}
                    </div>
                    <div className="tabular text-[22px] font-semibold leading-none">{tally[t.id] ?? 0}</div>
                    <div className="flex w-full items-center justify-between gap-2 rounded-xl border p-2" style={{ borderColor: dark + '.14)' }}>
                      <button aria-label={'Take one from ' + t.name} onClick={() => tap(t.id, -1)} className="h-11 w-11 rounded-full border" style={{ borderColor: dark + '.18)' }}>
                        <Icon name="ph ph-minus" className="text-[13px]" />
                      </button>
                      <span className="text-[13px] font-medium" style={{ color: dark + '.85)' }}>
                        {abbr(t.name)}
                      </span>
                      <button aria-label={t.name + ' scores'} onClick={() => tap(t.id)} className="h-11 w-11 rounded-full border-[1.5px] border-accent text-accent-200">
                        <Icon name="ph ph-plus" className="text-[13px]" />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex w-[118px] flex-none flex-col items-center gap-[6px]">
                  <div className="text-[13px] leading-none" style={{ color: dark + '.8)' }}>
                    {periodName(fmtGame, '1').replace(/ \d+$/, '')}
                  </div>
                  <div className="flex flex-wrap justify-center gap-[5px]">
                    {periodKeys(fmtGame).map((p) => (
                      <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p} className="min-h-11 min-w-11 rounded-lg border text-[11px] font-medium" style={{ borderColor: period === p ? 'var(--color-accent)' : dark + '.18)', background: period === p ? 'color-mix(in srgb, var(--color-accent) 22%, transparent)' : 'transparent' }}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-[6px]">
                    {(['up', 'down'] as const).map((md) => (
                      <button key={md} onClick={() => setClock((c) => ({ ...c, mode: md, base: 0, startedAt: null }))} aria-pressed={clock.mode === md} className="min-h-11 rounded-full border px-[10px] text-[11px]" style={{ borderColor: clock.mode === md ? 'var(--color-accent)' : dark + '.18)' }}>
                        {md === 'up' ? 'Up' : 'Down'}
                      </button>
                    ))}
                  </div>
                  {clock.mode === 'down' ? (
                    <div className="flex gap-[6px]">
                      <button onClick={() => setClock((c) => ({ ...c, target: Math.max(60, c.target - 60) }))} className="min-h-11 rounded-full border px-[11px] text-[11px]" style={{ borderColor: dark + '.18)' }}>
                        −1m
                      </button>
                      <button onClick={() => setClock((c) => ({ ...c, target: c.target + 60 }))} className="min-h-11 rounded-full border px-[11px] text-[11px]" style={{ borderColor: dark + '.18)' }}>
                        +1m
                      </button>
                    </div>
                  ) : null}
                  <div className="text-center text-[9.5px] leading-[1.3]" style={{ color: dark + '.45)' }}>
                    Trim the clock if a whistle beat you
                  </div>
                </div>
              </div>
              {source === 'tally' && scorer ? (
                <button
                  onClick={() => {
                    const ids = Object.keys(tally).filter((id) => tally[id] > 0);
                    if (!ids.length) return api().say('Nothing tallied yet.');
                    const flag = api().awardMany(ids.map((id) => ({ team: id, cat: 'games', amount: tally[id] * goal, why: 'Tallied on the filming scoreboard' })));
                    if (!flag) return;
                    setTally({});
                    api().sayPosted('Tally saved into Games points.', 'Tally held on this phone until you have signal.');
                  }}
                  className="min-h-11 rounded-lg border border-accent text-[12.5px] font-semibold"
                >
                  Save the tally to Games
                </button>
              ) : null}
            </>
          ) : null}

          {panel === 'setup' ? (
            <div className="flex flex-col gap-[10px]">
              <div className="text-[12px] leading-[1.5] text-pretty" style={{ color: dark + '.55)' }}>
                Who is on the floor. Only these squads appear on the scorebug.
              </div>
              <div className="flex flex-wrap gap-[7px]">
                {d.teams.map((t) => {
                  const on = floor.includes(t.id);
                  return (
                    <button key={t.id} onClick={() => setFloor((f) => (on ? f.filter((x) => x !== t.id) : f.concat(t.id)))} aria-pressed={on} className="flex min-h-11 items-center gap-[7px] rounded-lg border px-[13px] text-[12px] font-medium" style={{ borderColor: on ? t.color : dark + '.18)', background: on ? 'color-mix(in srgb, ' + t.color + ' 18%, transparent)' : 'transparent' }}>
                      <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: t.color }} />
                      {t.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} className="min-h-11 rounded-lg border px-[14px] text-[12px] font-medium" style={{ borderColor: dark + '.2)' }}>
                  <Icon name="ph ph-camera-rotate" className="mr-[7px] text-[14px]" />
                  Flip camera
                </button>
                {scorer ? (
                  <button onClick={() => setSource((s) => (s === 'app' ? 'tally' : 'app'))} className="min-h-11 rounded-lg border px-[14px] text-[12px] font-medium" style={{ borderColor: dark + '.2)' }}>
                    <Icon name="ph ph-arrows-left-right" className="mr-[7px] text-[14px]" />
                    {source === 'app' ? 'Taps post live' : 'Taps only tally'}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {panel === 'clips' ? <ClipsPanel /> : null}
        </div>
      </div>
    </div>,
    host
  );
}

function ClipsPanel() {
  const clips = useApp((s) => s.data.clips);
  const week = useApp((s) => s.data.config.weekNumber);
  const mine = clips.filter((c) => c.week === week);
  if (!mine.length)
    return (
      <div className="text-[11.5px] leading-[1.5] text-pretty" style={{ color: 'rgba(233,233,237,.5)' }}>
        Nothing filmed this week yet. Record, and the clip lands here and in the Week {week} album on Media.
      </div>
    );
  return (
    <div className="flex flex-col gap-[9px]">
      {mine.map((c) => (
        <div key={c.id} className="flex items-center gap-[10px] rounded-lg border px-[10px] py-[9px]" style={{ borderColor: 'rgba(233,233,237,.12)' }}>
          <Icon name="ph-fill ph-film-strip" className="flex-none text-[16px] text-accent-300" />
          <div className="min-w-0 flex-1">
            <div className="tabular truncate text-[12.5px] font-medium leading-[1.3]">{c.line || 'Clip'}</div>
            <div className="mt-[2px] text-[10.5px] leading-[1.3]" style={{ color: 'rgba(233,233,237,.5)' }}>
              {c.dur}s · {c.mb} MB{c.pins.length ? ' · ' + c.pins.length + ' pinned' : ''} · on this phone
            </div>
          </div>
        </div>
      ))}
      <div className="text-[10.5px] leading-[1.5]" style={{ color: 'rgba(233,233,237,.45)' }}>
        Play, save or share them from the Week {week} album on Media.
      </div>
    </div>
  );
}
