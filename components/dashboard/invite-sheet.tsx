'use client';
/* Invite someone — QR code or a link. "Join my squad" asks for access to the
   ministry; "Come cheer" is the read-only board: squad totals, no students. */
import QRCode from 'qrcode';
import { useEffect, useState } from 'react';
import { Sheet } from '@/components/sheet';
import { Btn, Icon } from '@/components/ui';
import { useApp, useAppApi } from '@/lib/store/provider';

export function InviteSheet({ open, onClose, initialMode = 'join' }: { open: boolean; onClose: () => void; initialMode?: 'join' | 'support' }) {
  const cfg = useApp((s) => s.data.config);
  const api = useAppApi();
  const [mode, setMode] = useState<'join' | 'support'>(initialMode);
  const [svg, setSvg] = useState('');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = mode === 'support' ? origin + '/b/' + (cfg.parentCode || 'demo') : origin + '/join/' + (cfg.inviteCode || 'demo');
  const message =
    mode === 'support'
      ? 'Come cheer for my squad at ' + cfg.ministryName + '. You can follow the scoreboard live: ' + url
      : 'Come to ' + cfg.ministryName + ' with me — join my squad for the season: ' + url;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    QRCode.toString(url, { type: 'svg', margin: 0, width: 164, errorCorrectionLevel: 'M', color: { dark: '#f3f5feff', light: '#161826ff' } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(''));
    return () => {
      alive = false;
    };
  }, [open, url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      api().say('Invite copied — paste it anywhere.');
    } catch {
      api().say('Copy failed — long-press the link instead.');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} label="Invite someone" z={94} maxH="92%">
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[17px] font-medium leading-[1.2] text-neutral-100">Invite someone</div>
        <button aria-label="Close share" onClick={onClose} className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-neutral-800 text-neutral-500">
          <Icon name="ph ph-x" className="text-[13px]" />
        </button>
      </div>
      <div className="flex gap-[7px]">
        {(
          [
            { id: 'join', label: 'Join my squad' },
            { id: 'support', label: 'Come cheer' }
          ] as const
        ).map((m) => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className="min-h-11 flex-1 rounded-md border px-[10px] text-[12px] font-medium leading-[1.3]"
            style={{
              borderColor: mode === m.id ? 'var(--color-accent-500)' : 'var(--color-neutral-800)',
              background: mode === m.id ? 'color-mix(in srgb, var(--color-accent) 14%, transparent)' : 'transparent',
              color: mode === m.id ? 'var(--color-accent-200)' : 'var(--color-neutral-400)'
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="text-[11.5px] leading-[1.5] text-neutral-500 text-pretty">
        {mode === 'support'
          ? 'For parents, grandparents and anyone who wants to follow the scoreboard. Read-only — no student information.'
          : 'For a friend you want on your team this season. They’ll register with the church first, then land on your squad.'}
      </div>
      <div className="self-center rounded-lg bg-bg p-[14px] shadow-sm">
        <div className="flex h-[164px] w-[164px] items-center justify-center" aria-label={'QR code for ' + url} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
      <div className="text-center text-[10.5px] leading-[1.4] text-neutral-500">Point a phone camera at this</div>
      <div className="break-all rounded-md border border-neutral-800 px-3 py-[11px] text-[12px] font-medium leading-[1.4] text-accent-200">{url}</div>
      <div className="flex flex-wrap gap-2">
        <Btn className="px-[14px]" onClick={copy}>
          <Icon name="ph ph-copy" className="text-[14px]" />
          Copy invite
        </Btn>
        <Btn variant="secondary" className="px-[14px]" href={'sms:?&body=' + encodeURIComponent(message)}>
          <Icon name="ph ph-chat-circle-text" className="text-[14px]" />
          Text it
        </Btn>
        <Btn
          variant="ghost"
          className="px-[14px]"
          onClick={async () => {
            if (navigator.share) {
              try {
                await navigator.share({ title: cfg.ministryName, text: message, url });
              } catch {
                /* cancelled */
              }
              return;
            }
            void copy();
          }}
        >
          <Icon name="ph ph-share-network" className="text-[14px]" />
          Share
        </Btn>
      </div>
      <div className="border-t border-divider pt-[11px] text-[11px] leading-[1.6] text-neutral-500 text-pretty">{message}</div>
    </Sheet>
  );
}
