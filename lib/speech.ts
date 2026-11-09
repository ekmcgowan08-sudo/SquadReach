/* The browser's own speech-to-text (Chrome, Edge, Safari), where it has one.
   Used for reciting a verse and for talking a lesson through. Nothing is
   recorded by SquadRise; the browser hands back words. */
export interface SpeechRec {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start(): void;
  stop(): void;
}

/** A recognizer, or null where this browser can't write speech down. */
export function newSpeechRec(lang = 'en-US'): SpeechRec | null {
  if (typeof window === 'undefined') return null;
  const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = true;
  return rec;
}

/** Everything heard so far, as one string. */
export const heardText = (results: ArrayLike<ArrayLike<{ transcript: string }>>) =>
  Array.from(results)
    .map((r) => r[0].transcript.trim())
    .filter(Boolean)
    .join(' ');
