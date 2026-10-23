/* Ready-made run sheets. Loading one replaces the sheet and leaves it
   unpublished; the pastor edits from there. */
import { RUN_SHEET_DEFAULT } from '@/lib/data/seed';
import type { RunSheetItem } from '@/lib/types/model';

export const RUN_TEMPLATES = [
  { id: 'rt-standard', label: 'Standard night', hint: 'Huddle, doors, groups, lesson, games, small group, out.' },
  { id: 'rt-gameheavy', label: 'Game night', hint: 'Short lesson, long games, no split.' },
  { id: 'rt-retreat', label: 'Retreat evening', hint: 'Worship, session, cabin groups, late hangout.' }
] as const;

const item = (id: string, time: string, label: string, where: string, who: string, detail: string, debrief = false): RunSheetItem => ({ id, time, label, where, who, detail, assignedTo: null, notifiedAt: null, ...(debrief ? { debrief } : {}) });

export function runTemplate(id: string, newId: () => string): RunSheetItem[] {
  const base = RUN_SHEET_DEFAULT.map((it) => ({ ...it, id: newId(), assignedTo: null, notifiedAt: null }) as RunSheetItem);
  if (id === 'rt-gameheavy')
    return base
      .filter((it) => it.label !== 'Split to groups')
      .map((it) =>
        it.label === 'Lesson'
          ? { ...it, time: '7:10pm', label: 'Short lesson', detail: 'Fifteen minutes. One point, one verse, done — the night belongs to the game.' }
          : it.label === 'Games'
            ? { ...it, time: '7:30pm', detail: 'The main event. Two heats and a final, scorekeeper on the clock.' }
            : it
      );
  if (id === 'rt-retreat')
    return [
      item(newId(), '6:00pm', 'Leader huddle', 'Dining hall', 'Everyone serving', 'Cabin assignments, medical notes, who is watching whom.'),
      item(newId(), '7:00pm', 'Worship', 'Main room', 'Worship team', 'Leaders sit with their cabin, not at the back.'),
      item(newId(), '7:40pm', 'Session', 'Main room', 'Speaker', ''),
      item(newId(), '8:30pm', 'Cabin groups', 'Cabins', 'Leaders', 'The guide is under Season › Small groups.'),
      item(newId(), '9:30pm', 'Hangout + snack', 'Dining hall', 'Everyone', 'Two leaders awake at all times.'),
      item(newId(), '11:00pm', 'Lights out · leader debrief', 'Dining hall', 'Everyone serving', 'What worked, who needs following up on, pray, sleep.', true)
    ];
  return base;
}
