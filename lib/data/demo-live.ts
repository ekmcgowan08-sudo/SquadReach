/* DEMO MODE — live ministry time on one device. The room and its answers
   sit in localStorage, and a BroadcastChannel carries each change to the
   other tabs, so a second window can be the room screen and a third a
   student's phone. Nothing leaves the device. */
import type { LiveChannel } from '@/lib/data/backend';
import type { LiveAnswer, LiveRoom } from '@/lib/live';

const KEY = 'squadrise_live_v1';
type Night = { room: LiveRoom | null; answers: LiveAnswer[] };
type Msg = { night: string; room?: LiveRoom; answer?: LiveAnswer; cleared?: boolean };

const read = (): Record<string, Night> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, Night>;
  } catch {
    return {};
  }
};
const write = (all: Record<string, Night>) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* blocked storage: this tab still runs the night, others won't follow */
  }
};

const local = new Set<(m: Msg) => void>();
let bc: BroadcastChannel | null = null;
const channel = () => {
  if (bc || typeof BroadcastChannel === 'undefined') return bc;
  bc = new BroadcastChannel('squadrise-live');
  bc.onmessage = (e: MessageEvent<Msg>) => local.forEach((f) => f(e.data));
  return bc;
};
const send = (m: Msg) => {
  local.forEach((f) => f(m));
  channel()?.postMessage(m);
};

export const demoLive: LiveChannel = {
  async load(night) {
    return read()[night] ?? { room: null, answers: [] };
  },
  async room(night, room) {
    const all = read();
    all[night] = { answers: all[night]?.answers ?? [], room };
    write(all);
    send({ night, room });
  },
  async answer(night, a) {
    const all = read();
    const n = all[night] ?? { room: null, answers: [] };
    n.answers = [...n.answers.filter((x) => !(x.act === a.act && x.member === a.member)), a];
    all[night] = n;
    write(all);
    send({ night, answer: a });
  },
  async clear(night) {
    const all = read();
    if (all[night]) all[night].answers = [];
    write(all);
    send({ night, cleared: true });
  },
  subscribe(night, on) {
    channel();
    const f = (m: Msg) => {
      if (m.night !== night) return;
      on({ room: m.room, answer: m.answer, cleared: m.cleared });
    };
    local.add(f);
    return () => void local.delete(f);
  }
};
