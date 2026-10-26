'use client';
/* Getting the room screen in front of the room. Three ways, best first:
   a second display on this computer (the room window opens on it), a TV
   or cast device (Chrome's cast picker, through the Presentation API), or
   a link opened on any other screen's browser. The last two need no
   sign-in on that screen, so they go through a cast link that reads only
   the room snapshot and ends after twelve hours or when stopped. */
import { useState, useSyncExternalStore } from 'react';
import { Sheet } from '@/components/sheet';
import { Btn, Icon } from '@/components/ui';
import { useApp } from '@/lib/store/provider';

interface ScreenDetailed {
  left: number;
  top: number;
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
}
type WithScreens = Window & { getScreenDetails?: () => Promise<{ screens: ScreenDetailed[]; currentScreen: ScreenDetailed }> };
type Presenting = Window & { PresentationRequest?: new (urls: string[]) => { start(): Promise<unknown> } };

/** True while this computer has a second display it can place windows on. */
function useOtherScreen() {
  return useSyncExternalStore(
    (on) => {
      const s = window.screen as Screen & Partial<EventTarget>;
      s.addEventListener?.('change', on);
      return () => s.removeEventListener?.('change', on);
    },
    () => !!(window.screen as Screen & { isExtended?: boolean }).isExtended && 'getScreenDetails' in window,
    () => false
  );
}

const canPresent = () => typeof window !== 'undefined' && 'PresentationRequest' in window;

/* The window opens inside the click, so it isn't blocked; then it moves
   to the other display once the browser says where that is. */
async function openRoom(href: string, other: boolean) {
  if (!other) {
    window.open(href, '_blank');
    return;
  }
  const pop = window.open(href, 'squadrise-room', 'popup,width=1280,height=720');
  if (!pop) return;
  try {
    const { screens, currentScreen } = await (window as WithScreens).getScreenDetails!();
    const to = screens.find((s) => s.left !== currentScreen.left || s.top !== currentScreen.top);
    if (!to) return;
    pop.moveTo(to.availLeft, to.availTop);
    pop.resizeTo(to.availWidth, to.availHeight);
  } catch {
    /* Window placement refused: the room window stays where it opened. */
  }
}

export function ShowRoom({ night }: { night: string }) {
  const live = useApp((s) => s.backend.live);
  const say = useApp((s) => s.say);
  const other = useOtherScreen();
  const [sheet, setSheet] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const href = '/live/room?night=' + night;

  const mint = async () => {
    setError('');
    try {
      setUrl(await live.cast!(night));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t make a cast link.');
    }
  };
  const present = async () => {
    if (!url) return;
    setError('');
    try {
      await new (window as Presenting).PresentationRequest!([url]).start();
      say('Casting the room screen.');
      setSheet(false);
    } catch (e) {
      const name = (e as DOMException).name;
      if (name === 'NotAllowedError' || name === 'AbortError') return;
      setError(name === 'NotFoundError' ? 'No TV turned up on this network. Open the link below on the TV’s browser instead.' : 'That TV couldn’t take it. Open the link below on its browser instead.');
    }
  };
  const stop = async () => {
    try {
      await live.uncast!(night);
      setUrl(null);
      say('Cast links for tonight stopped. A screen showing one goes dark within a few seconds.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t stop casting.');
    }
  };

  return (
    <>
      <button onClick={() => void openRoom(href, other)} className="flex min-h-11 items-center rounded-full border border-neutral-800 px-3 text-[12px] font-medium text-neutral-200">
        <Icon name={other ? 'ph ph-monitor' : 'ph ph-arrow-square-out'} className="mr-[6px] text-[13px]" />
        {other ? 'Show on the other screen' : 'Open the room screen'}
      </button>
      {live.cast ? (
        <button
          onClick={() => {
            setSheet(true);
            if (!url) void mint();
          }}
          className="flex min-h-11 items-center rounded-full border border-neutral-800 px-3 text-[12px] font-medium text-neutral-200"
        >
          <Icon name="ph ph-screencast" className="mr-[6px] text-[13px]" />
          Cast to a TV
        </button>
      ) : null}
      <Sheet open={sheet} onClose={() => setSheet(false)} label="Cast the room screen">
        <div className="flex flex-col gap-3 px-5 pb-6 pt-2">
          <div className="text-[17px] font-medium text-neutral-100">Cast the room screen</div>
          <p className="text-[13px] leading-[1.55] text-neutral-400">
            The TV needs no sign-in. Anyone with this link sees what the room screen shows — the question, the results your settings allow, the ranks — for the next 12 hours, or until you stop it.
          </p>
          {canPresent() ? (
            <Btn className="justify-center" onClick={() => void present()} disabled={!url}>
              <Icon name="ph ph-screencast" className="mr-2 text-[15px]" />
              Choose a TV
            </Btn>
          ) : null}
          <div className="rounded-xl border border-neutral-800 px-4 py-3">
            <div className="text-[11px] text-neutral-500">{canPresent() ? 'Or open this on the TV’s browser' : 'Open this on the TV’s browser or the projector’s computer'}</div>
            <div className="mt-1 break-all font-mono text-[12px] text-neutral-200">{url ?? (error ? '—' : 'Making the link…')}</div>
          </div>
          {error ? (
            <p role="alert" className="text-[12.5px] text-[oklch(0.78_0.12_40)]">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Btn
              variant="secondary"
              className="px-4 text-[12.5px]"
              disabled={!url}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url!);
                  say('Cast link copied.');
                } catch {
                  setError('Couldn’t copy. Select the link above instead.');
                }
              }}
            >
              Copy the link
            </Btn>
            {url ? (
              <Btn variant="ghost" className="px-4 text-[12.5px]" onClick={() => void stop()}>
                Stop casting tonight
              </Btn>
            ) : error ? (
              <Btn variant="ghost" className="px-4 text-[12.5px]" onClick={() => void mint()}>
                Try again
              </Btn>
            ) : null}
          </div>
        </div>
      </Sheet>
    </>
  );
}
