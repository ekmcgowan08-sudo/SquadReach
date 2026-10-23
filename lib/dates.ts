/* Dates are the spine of a season (decided in review): week numbers come
   from the meeting dates, not the other way round. */

export const isoDay = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
};

export function parseLocalISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

/** Tonight's meeting: today if it is a meeting night, else the next one,
 *  else the last one (a season that has ended still shows its final board). */
export function tonightDate(meetingDates: string[], now = new Date()): string {
  const today = isoDay(now);
  const sorted = meetingDates.slice().sort();
  return sorted.find((d) => d >= today) ?? sorted[sorted.length - 1] ?? today;
}

/** Week N of the season, counted from the meeting dates. */
export function weekOf(meetingDates: string[], date: string): number {
  const sorted = meetingDates.slice().sort();
  const i = sorted.indexOf(date);
  if (i >= 0) return i + 1;
  return Math.max(1, sorted.filter((d) => d <= date).length);
}

export function shortDate(iso: string): string {
  const d = parseLocalISO(iso);
  return d ? d.getMonth() + 1 + '/' + d.getDate() : iso;
}

export function longDate(iso: string): string {
  const d = parseLocalISO(iso);
  return d ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) : iso;
}

export function ago(ts: number, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + ' min ago';
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? hrs + 'h ago' : Math.round(hrs / 24) + 'd ago';
}

/** The clock, for event handlers. (Render code reads time through useNow so
 *  a render stays a pure function of state.) */
export const nowMs = () => Date.now();

/** Which voting period a moment falls in: the season, the day, or the ISO week. */
export function periodKey(freq: string | undefined, now = new Date()): string {
  if (freq === 'daily') return isoDay(now);
  if (freq === 'weekly') {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return d.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
  }
  return 'season';
}
