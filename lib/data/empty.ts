/* A ministry with nothing in it yet — the shape a Supabase load fills in.
   Every list starts empty; nothing here is demo data. */
import { DEFAULT_MEMORY_VERSES } from '@/lib/bible';
import { DEFAULT_PENALTIES, emptyGame } from '@/lib/game';
import { DEFAULT_READY } from '@/lib/data/seed';
import type { MinistryConfig, MinistryData } from '@/lib/types/model';

export const DEFAULT_CONFIG: MinistryConfig = {
  ministryName: 'Your ministry',
  pointBase: 400,
  weekGrowthPct: 8,
  goalValue: 25,
  versePts: 20,
  verseBoard: 25,
  weekNumber: 1,
  seasonWeeks: 9,
  meetingDates: [],
  gameName: '',
  venueAddress: '',
  parentCode: '',
  inviteCode: '',
  church: { address: '', phone: '', email: '', web: '', studentsPage: '', instagram: '', youtube: '', facebook: '', tiktok: '' },
  checkinAutoCats: { visitors: true },
  memoryVerses: DEFAULT_MEMORY_VERSES,
  penalties: DEFAULT_PENALTIES,
  gameSetup: { rulesText: '', rulesVideoUrl: '', fieldTypes: [], offsiteAddress: '', markupDataUrl: null, gameWeeks: null },
  parentShare: { standings: true, mvp: false, verse: true, photos: false, calendar: true }
};

export function emptyMinistry(): MinistryData {
  return {
    config: { ...DEFAULT_CONFIG },
    teams: [],
    cats: [],
    roster: [],
    ledger: [],
    studentSeedPoints: {},
    prayers: [],
    prayerQueue: [],
    careReminders: [],
    events: [],
    challenges: [],
    accessRequests: [],
    activityLog: [],
    huddle: {
      runSheet: [], runIdx: 0, runDone: {}, runAdvancedAt: Date.now(), crew: [], crewState: {}, crewAdded: [],
      bench: [], openPosts: [], covered: {}, subAsks: {}, note: '', debriefNotes: [], nightClosed: false,
      ready: DEFAULT_READY.map((r) => ({ ...r, done: false })), dismissed: {}
    },
    visitorLog: [],
    verseLog: [],
    achievements: [],
    studentBadges: [],
    smallGroups: [],
    deepSubs: [],
    awards: [],
    awardVotes: {},
    media: [],
    clips: [],
    chatThreads: [],
    chatMsgs: {},
    chatUnread: {},
    rsvps: {},
    attendanceHistory: {},
    practiceLog: [],
    tonight: { date: '', presence: {}, checkinDetail: {}, checkinPosted: {}, goals: {}, pushed: {}, heatPosted: null },
    game: emptyGame(),
    bracket: { enabled: false, seeds: [], winners: {}, liveSeed: true, paid: {} },
    challengeCredit: {}
  };
}
