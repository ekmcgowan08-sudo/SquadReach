/* The church year, computed per year. Easter by the Meeus/Jones/Butcher
   (Gregorian) algorithm; every movable day is an offset from it or from
   Christmas. Dates are local calendar days ("YYYY-MM-DD"), never instants. */

const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (y: number, m: number, d: number) => {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate());
};
const parts = (iso: string) => iso.split('-').map(Number) as [number, number, number];
export const addDays = (iso: string, n: number) => {
  const [y, m, d] = parts(iso);
  return ymd(y, m, d + n);
};
/** 0 = Sunday. */
export const weekdayOf = (iso: string) => {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** Western (Gregorian) Easter Sunday. */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/** The first Sunday of Advent: the fourth Sunday before Christmas. */
export function advent1(year: number): string {
  const xmas = ymd(year, 12, 25);
  const back = weekdayOf(xmas) || 7; // Christmas on a Sunday → the Sunday before
  return addDays(xmas, -back - 21);
}

export interface HolyDay {
  id: string;
  name: string;
  /** A season spans days; a day is a single date. */
  kind: 'day' | 'season';
  date: string;
  /** Last day, for seasons. */
  until?: string;
}

/** Every holy day and season that starts in a calendar year. */
export function churchYear(year: number): HolyDay[] {
  const e = easter(year);
  const a1 = advent1(year);
  const epiphany = ymd(year, 1, 6);
  const baptism = addDays(epiphany, 7 - weekdayOf(epiphany)); // the Sunday after — never Epiphany itself
  const ash = addDays(e, -46);
  return [
    { id: 'epiphany', name: 'Epiphany', kind: 'day', date: epiphany },
    { id: 'baptism', name: 'Baptism of the Lord', kind: 'day', date: baptism },
    { id: 'transfiguration', name: 'Transfiguration', kind: 'day', date: addDays(ash, -3) },
    { id: 'ash', name: 'Ash Wednesday', kind: 'day', date: ash },
    { id: 'lent', name: 'Lent', kind: 'season', date: ash, until: addDays(e, -8) },
    { id: 'palm', name: 'Palm Sunday', kind: 'day', date: addDays(e, -7) },
    { id: 'holyweek', name: 'Holy Week', kind: 'season', date: addDays(e, -7), until: addDays(e, -1) },
    { id: 'maundy', name: 'Maundy Thursday', kind: 'day', date: addDays(e, -3) },
    { id: 'goodfriday', name: 'Good Friday', kind: 'day', date: addDays(e, -2) },
    { id: 'easter', name: 'Easter', kind: 'day', date: e },
    { id: 'eastertide', name: 'Easter season', kind: 'season', date: e, until: addDays(e, 48) },
    { id: 'ascension', name: 'Ascension', kind: 'day', date: addDays(e, 39) },
    { id: 'pentecost', name: 'Pentecost', kind: 'day', date: addDays(e, 49) },
    { id: 'trinity', name: 'Trinity Sunday', kind: 'day', date: addDays(e, 56) },
    { id: 'ordinary', name: 'Ordinary Time', kind: 'season', date: addDays(e, 50), until: addDays(a1, -1) },
    { id: 'allsaints', name: 'All Saints’', kind: 'day', date: ymd(year, 11, 1) },
    { id: 'christking', name: 'Christ the King', kind: 'day', date: addDays(a1, -7) },
    { id: 'advent', name: 'Advent', kind: 'season', date: a1, until: ymd(year, 12, 24) },
    { id: 'christmas', name: 'Christmas', kind: 'day', date: ymd(year, 12, 25) },
    { id: 'christmastide', name: 'Christmas season', kind: 'season', date: ymd(year, 12, 25), until: ymd(year + 1, 1, 5) }
  ];
}

export const LITURGICAL_DAYS = churchYear(2000).map((x) => ({ id: x.id, name: x.name, kind: x.kind }));

/** Holy days (single days) falling between two dates, inclusive. */
export function holyDaysBetween(from: string, to: string): HolyDay[] {
  const out: HolyDay[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) for (const h of churchYear(y)) if (h.date >= from && h.date <= to) out.push(h);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
