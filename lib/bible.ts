/* Scripture: the week's memory verse, the drills, and the practice streak.

   Only public-domain translations carry text. The licensed ones are listed so
   a ministry can see what linking a provider would add, and say so plainly
   instead of showing a blank card. */
import { isoDay } from '@/lib/dates';
import type { MemoryVerse, PracticeRow } from '@/lib/types/model';

export const LANGS = [
  { id: 'en', label: 'English', versions: ['KJV', 'ASV', 'NKJV', 'NASB', 'NLT', 'NIV'] },
  { id: 'es', label: 'Español', versions: ['RVR1909'] }
] as const;
export type LangId = (typeof LANGS)[number]['id'];

export const LICENSE_STATUS: Record<string, string> = {
  KJV: 'Public domain',
  ASV: 'Public domain',
  RVR1909: 'Public domain',
  NKJV: 'Needs license · Thomas Nelson',
  NASB: 'Needs license · The Lockman Foundation',
  NLT: 'Needs license · Tyndale House',
  NIV: 'Needs license · Biblica'
};

/** Translations the chapter reader can fetch (bible-api.com, public domain). */
export const READER_TRANSLATIONS: Record<string, string> = { KJV: 'kjv', ASV: 'asv' };

/** One verse per week. KJV text throughout; the current week carries more. */
export const DEFAULT_MEMORY_VERSES: MemoryVerse[] = [
  { week: 1, ref: 'John 3:16', text: { KJV: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.' } },
  { week: 2, ref: 'Philippians 4:13', text: { KJV: 'I can do all things through Christ which strengtheneth me.' } },
  { week: 3, ref: 'Proverbs 3:5', text: { KJV: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.' } },
  { week: 4, ref: 'Psalm 119:105', text: { KJV: 'Thy word is a lamp unto my feet, and a light unto my path.' } },
  { week: 5, ref: 'Romans 8:28', text: { KJV: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' } },
  { week: 6, ref: '1 Timothy 4:12', text: { KJV: 'Let no man despise thy youth; but be thou an example of the believers, in word, in conversation, in charity, in spirit, in faith, in purity.' } },
  { week: 7, ref: 'Matthew 5:16', text: { KJV: 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.' } },
  { week: 8, ref: 'Isaiah 40:31', text: { KJV: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.' } },
  {
    week: 9,
    ref: 'Joshua 1:9',
    text: {
      KJV: 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
      ASV: 'Have not I commanded thee? Be strong and of good courage; be not affrighted, neither be thou dismayed: for Jehovah thy God is with thee whithersoever thou goest.',
      RVR1909: 'Mira que te mando que te esfuerces y seas valiente: no temas ni desmayes, porque Jehová tu Dios será contigo en donde quiera que fueres.'
    }
  }
];

/** The verse for a week: that week's, else the latest one before it. */
export function verseForWeek(list: MemoryVerse[], week: number): MemoryVerse | null {
  const sorted = [...list].sort((a, b) => a.week - b.week);
  let pick: MemoryVerse | null = null;
  for (const v of sorted) if (v.week <= week) pick = v;
  return pick ?? sorted[0] ?? null;
}

export const words = (text: string) => text.split(/\s+/).filter(Boolean);
/** Letters only, lowercased — how a typed or spoken word is compared. */
export const norm = (w: string) =>
  w
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z']/g, '')
    .toLowerCase();

export function firstLetters(text: string): string {
  return words(text)
    .map((w) => {
      const lead = w.match(/^[^\p{L}]*\p{L}/u)?.[0] ?? w[0];
      const tail = w.match(/[.,;:!?"'’]+$/)?.[0] ?? '';
      return lead + tail;
    })
    .join(' ');
}

/** Every fourth word from the third, so a blank lands in every phrase. */
export const blankIdxs = (text: string) => words(text).map((_, i) => i).filter((i) => i % 4 === 2);

/** Word-for-word marks of an attempt against the verse, in order. */
export function markAttempt(text: string, attempt: string): { right: number; total: number; marks: boolean[] } {
  const target = words(text).map(norm);
  const got = words(attempt).map(norm);
  const marks = target.map((w, i) => got[i] === w);
  return { right: marks.filter(Boolean).length, total: target.length, marks };
}

/** Spoken recall forgives skipped filler: a word counts if it shows up nearby. */
export function markSpoken(text: string, heard: string): { right: number; total: number } {
  const target = words(text).map(norm);
  const got = words(heard).map(norm);
  let cursor = 0;
  let right = 0;
  for (const w of target) {
    const at = got.indexOf(w, cursor);
    if (at >= 0 && at - cursor <= 3) {
      right++;
      cursor = at + 1;
    }
  }
  return { right, total: target.length };
}

export function shuffled<T>(list: T[], seed = Date.now()): T[] {
  const a = [...list];
  let s = seed % 2147483647 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 48271) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const PRACTICE_XP = 25;
/** A verse is due for review if nobody's practiced it in this many days. */
export const REVIEW_DAYS = 7;

export interface BibleStats {
  streak: number;
  xp: number;
  due: number;
  loggedToday: boolean;
  verses: number;
}

/** Streak, XP and verses due for one person, from their practice rows. */
export function bibleStats(rows: PracticeRow[], verses: MemoryVerse[], week: number, now = new Date()): BibleStats {
  const days = new Set(rows.map((r) => r.day));
  const today = isoDay(now);
  const loggedToday = days.has(today);
  let streak = 0;
  const cursor = new Date(now);
  if (!loggedToday) cursor.setDate(cursor.getDate() - 1);
  while (days.has(isoDay(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - REVIEW_DAYS);
  const recent = new Set(rows.filter((r) => r.day >= isoDay(cutoff)).map((r) => r.ref));
  const learned = verses.filter((v) => v.week <= week);
  return {
    streak,
    xp: rows.length * PRACTICE_XP,
    due: learned.filter((v) => !recent.has(v.ref)).length,
    loggedToday,
    verses: new Set(rows.map((r) => r.ref)).size
  };
}

export const BOOKS: { name: string; chapters: number; nt: boolean }[] = (
  [
    ['Genesis', 50], ['Exodus', 40], ['Leviticus', 27], ['Numbers', 36], ['Deuteronomy', 34], ['Joshua', 24], ['Judges', 21], ['Ruth', 4],
    ['1 Samuel', 31], ['2 Samuel', 24], ['1 Kings', 22], ['2 Kings', 25], ['1 Chronicles', 29], ['2 Chronicles', 36], ['Ezra', 10], ['Nehemiah', 13],
    ['Esther', 10], ['Job', 42], ['Psalms', 150], ['Proverbs', 31], ['Ecclesiastes', 12], ['Song of Solomon', 8], ['Isaiah', 66], ['Jeremiah', 52],
    ['Lamentations', 5], ['Ezekiel', 48], ['Daniel', 12], ['Hosea', 14], ['Joel', 3], ['Amos', 9], ['Obadiah', 1], ['Jonah', 4], ['Micah', 7],
    ['Nahum', 3], ['Habakkuk', 3], ['Zephaniah', 3], ['Haggai', 2], ['Zechariah', 14], ['Malachi', 4]
  ] as [string, number][]
)
  .map(([name, chapters]) => ({ name, chapters, nt: false }))
  .concat(
    (
      [
        ['Matthew', 28], ['Mark', 16], ['Luke', 24], ['John', 21], ['Acts', 28], ['Romans', 16], ['1 Corinthians', 16], ['2 Corinthians', 13],
        ['Galatians', 6], ['Ephesians', 6], ['Philippians', 4], ['Colossians', 4], ['1 Thessalonians', 5], ['2 Thessalonians', 3], ['1 Timothy', 6],
        ['2 Timothy', 4], ['Titus', 3], ['Philemon', 1], ['Hebrews', 13], ['James', 5], ['1 Peter', 5], ['2 Peter', 3], ['1 John', 5], ['2 John', 1],
        ['3 John', 1], ['Jude', 1], ['Revelation', 22]
      ] as [string, number][]
    ).map(([name, chapters]) => ({ name, chapters, nt: true }))
  );

export interface ChapterVerse {
  verse: number;
  text: string;
}

/** Fetch one chapter of a public-domain translation. Throws on no signal. */
export async function fetchChapter(book: string, chapter: number, version: string, signal?: AbortSignal): Promise<ChapterVerse[]> {
  const t = READER_TRANSLATIONS[version] ?? 'kjv';
  const res = await fetch('https://bible-api.com/' + encodeURIComponent(book + ' ' + chapter) + '?translation=' + t, { signal });
  if (!res.ok) throw new Error('Reader returned ' + res.status);
  const body = (await res.json()) as { verses?: { verse: number; text: string }[] };
  return (body.verses ?? []).map((v) => ({ verse: v.verse, text: v.text.replace(/\s+/g, ' ').trim() }));
}
