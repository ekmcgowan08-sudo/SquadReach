/* Starting points for a small-group screen, and pictures to put on one.
   The idea bank fills a new screen of a type with something worth saying;
   the picture bank is a set of drawn tiles (an icon on a colour) a leader
   can search by word — a picture needs no upload to look finished. */
import type { SmallGroupScreen, SmallGroupImage } from '@/lib/types/model';

export type Idea = Pick<SmallGroupScreen, 'title' | 'body'> & Partial<Pick<SmallGroupScreen, 'ref' | 'options' | 'items' | 'videoUrl' | 'timerSeconds'>>;

export const IDEA_BANK: Record<string, Idea[]> = {
  thought: [
    { title: 'Assumptions', body: 'What is one thing people assume about you that isn’t true?' },
    { title: 'Bravest moment', body: 'What is the bravest thing you’ve done this month?' },
    { title: 'One word', body: 'If you had to describe this week in one word, what would it be — and why?' }
  ],
  scripture: [
    { title: 'Strength in Him', body: 'I can do all things through him who strengthens me.', ref: 'Philippians 4:13' },
    {
      title: 'Do not fear',
      body: 'Have I not commanded you? Be strong and courageous. Do not be frightened, and do not be dismayed, for the LORD your God is with you wherever you go.',
      ref: 'Joshua 1:9'
    },
    { title: 'All things for good', body: 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.', ref: 'Romans 8:28' }
  ],
  game: [
    { title: 'Two truths, one lie', body: 'Everyone shares three “facts” about themselves — the group guesses the lie.' },
    { title: '60-second sculpture', body: 'Give everyone a pipe cleaner. Build something in 60 seconds, then guess what each person made.' },
    { title: 'Silent line-up', body: 'Without talking, line up by birthday month. See how fast the group can do it.' }
  ],
  pass: [
    { title: 'Pass it on: a win', body: 'Pass the phone to your left. They share one win from this week.' },
    { title: 'Pass it on: a verse', body: 'Pass the phone. The next person shares a verse that has stuck with them recently.' }
  ],
  poll: [
    { title: 'Quick vote', body: 'Which spiritual discipline do you want to focus on this month?', options: ['Prayer', 'Scripture reading', 'Serving others', 'Gratitude'] },
    { title: 'Quick vote', body: 'Where do you feel closest to God?', options: ['Worship', 'Nature', 'Quiet alone time', 'Serving with others'] }
  ],
  checklist: [
    { title: 'Prayer huddle', body: 'Work through this together before you leave the circle.', items: ['Everyone shares one prayer request', 'Pick a verse to memorize together', 'Set a time to check in on each other this week'] },
    { title: 'Serve together', body: 'Plan one small act of service as a group.', items: ['Pick one person or family to encourage', 'Decide what you’ll do', 'Assign who brings what'] }
  ],
  video: [
    { title: 'Testimony clip', body: 'Play a short testimony video, then open it up for discussion.', videoUrl: '' },
    { title: 'Worship moment', body: 'Play a worship song to open the night.', videoUrl: '' }
  ],
  spinner: [
    { title: 'Who shares first', body: '', items: ['Person 1', 'Person 2', 'Person 3', 'Person 4'] },
    { title: 'Pick a Bible reader', body: '', items: ['Reader 1', 'Reader 2', 'Reader 3'] },
    { title: 'Next question picker', body: '', items: ['Team captain', 'Newest member', 'Loudest laugher', 'Leader'] }
  ],
  timer: [
    { title: '2-minute discussion', body: 'Talk it over in pairs.', timerSeconds: 120 },
    { title: '60-second challenge', body: 'Beat the clock.', timerSeconds: 60 },
    { title: '5-minute activity', body: 'Time to build, draw, or write.', timerSeconds: 300 }
  ],
  prayer: [
    { title: 'Tonight’s requests', body: 'Whatever’s on your heart — tap each one as you pray.', items: ['For our team', 'For a friend who doesn’t know Jesus yet', 'For families going through something hard'] },
    { title: 'Before we go', body: 'Close the night lifting these up together.', items: ['Safe travels home', 'Rest this week', 'Courage to invite a friend next week'] }
  ],
  wyr: [
    { title: 'Would you rather', body: '', options: ['Give up your phone for a week', 'Give up dessert for a month'] },
    { title: 'Would you rather', body: '', options: ['Be famous for something embarrassing', 'Never be famous at all'] },
    { title: 'Would you rather', body: '', options: ['Always be 10 minutes late', 'Always be an hour early'] }
  ]
};

export const ideasFor = (type: string): Idea[] => IDEA_BANK[type] ?? [];

/** A new screen of this type, from an idea or blank. Lists are copied, so
 *  editing the screen never edits the bank. */
export function screenFrom(type: string, id: string, idea?: Idea): SmallGroupScreen {
  const base: SmallGroupScreen = { id, type, title: '', body: '' };
  if (type === 'timer') base.timerSeconds = 120;
  if (!idea) return base;
  return {
    ...base,
    ...idea,
    options: idea.options ? [...idea.options] : undefined,
    items: idea.items ? [...idea.items] : undefined
  };
}

export interface BankPicture {
  id: string;
  label: string;
  tags: string[];
  icon: string;
  color: string;
}

export const PICTURE_BANK: BankPicture[] = [
  { id: 'ministry-huddle', label: 'Team huddle', tags: ['team', 'huddle', 'group', 'sports'], icon: 'ph ph-users-three', color: '#3a5a8f' },
  { id: 'worship-hands', label: 'Worship night', tags: ['worship', 'church', 'hands', 'faith'], icon: 'ph ph-hand-heart', color: '#5a3a8f' },
  { id: 'basketball-court', label: 'Basketball', tags: ['sports', 'basketball', 'game', 'gym'], icon: 'ph ph-basketball', color: '#3a8f5a' },
  { id: 'campfire', label: 'Campfire circle', tags: ['camp', 'outdoors', 'night', 'retreat'], icon: 'ph ph-campfire', color: '#8f5a3a' },
  { id: 'bible-open', label: 'Open Bible', tags: ['bible', 'scripture', 'study', 'book'], icon: 'ph ph-book-bookmark', color: '#3a6a8f' },
  { id: 'crowd-cheer', label: 'Crowd cheering', tags: ['crowd', 'cheer', 'event', 'stadium'], icon: 'ph ph-megaphone', color: '#8f3a5a' },
  { id: 'sunset-field', label: 'Sunset field', tags: ['sunset', 'outdoors', 'nature', 'field'], icon: 'ph ph-sun', color: '#8f6a3a' },
  { id: 'locker-room', label: 'Locker room', tags: ['locker', 'team', 'sports', 'pregame'], icon: 'ph ph-t-shirt', color: '#4a4a8f' },
  { id: 'baptism', label: 'Baptism', tags: ['baptism', 'water', 'faith', 'church'], icon: 'ph ph-drop', color: '#3a8f8f' },
  { id: 'logo-placeholder', label: 'Ministry logo', tags: ['logo', 'brand', 'ministry'], icon: 'ph ph-image-square', color: '#5a5a5a' }
];

/** Every typed word has to match the label or a tag. */
export function searchPictures(q: string): BankPicture[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return PICTURE_BANK;
  return PICTURE_BANK.filter((p) => words.every((w) => p.label.toLowerCase().includes(w) || p.tags.some((t) => t.startsWith(w))));
}

export const pictureOf = (id: string | null | undefined) => PICTURE_BANK.find((p) => p.id === id) ?? null;

export const DEFAULT_IMAGE: SmallGroupImage = { src: null, bankId: null, layer: 'above', posX: 50, posY: 50, scale: 100, opacity: 100 };

export const LAYERS: { id: SmallGroupImage['layer']; label: string; hint: string }[] = [
  { id: 'behind', label: 'Behind', hint: 'fills the screen, under the words' },
  { id: 'above', label: 'Above', hint: 'a picture over the headline' },
  { id: 'below', label: 'Below', hint: 'a picture under the words' }
];

/** Kept inside the bounds the editor offers, whatever was saved. */
export function cleanImage(img: SmallGroupImage): SmallGroupImage {
  const clamp = (n: number, lo: number, hi: number, d: number) => (Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d);
  return {
    src: img.src,
    bankId: img.src ? null : img.bankId,
    layer: LAYERS.some((l) => l.id === img.layer) ? img.layer : 'above',
    posX: clamp(img.posX, 0, 100, 50),
    posY: clamp(img.posY, 0, 100, 50),
    scale: clamp(img.scale, 50, 160, 100),
    opacity: clamp(img.opacity, 20, 100, 100)
  };
}
