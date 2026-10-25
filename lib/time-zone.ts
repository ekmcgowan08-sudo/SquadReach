/* A ministry's own clock. The browser already runs in the ministry's time
   zone; a server (UTC, usually) doesn't. `inZone` shifts a moment so that
   the runtime's local getters read the ministry's wall clock — then the
   same schedule code (deliveryDue and friends) works on both. */

/** Minutes the zone is ahead of UTC at that moment (negative west of it). */
export function zoneOffset(tz: string, at: number): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(at));
    const n = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
    const wall = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
    return Math.round((wall - Math.floor(at / 1000) * 1000) / 60000);
  } catch {
    return 0;
  }
}

/** `at`, moved so local getters show the wall clock in `tz`. */
export function inZone(at: number, tz: string): number {
  const runtime = -new Date(at).getTimezoneOffset();
  return at + (zoneOffset(tz, at) - runtime) * 60000;
}

export const ZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'America/Puerto_Rico', 'Europe/London', 'Europe/Berlin', 'Africa/Lagos', 'Africa/Nairobi', 'Asia/Manila', 'Asia/Seoul', 'Australia/Sydney'];
export const DEFAULT_ZONE = 'America/Chicago';
