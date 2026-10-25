/* SUPABASE MODE — live ministry time over two tables. The room is one row a
   leader's console writes; answers are one row per person per activity,
   accepted only while that activity is open (live_open in the migration).
   Realtime brings both back: every member hears the room, and RLS means a
   student hears only their own answers while a leader hears the room's. */
import type { LiveChannel } from '@/lib/data/backend';
import type { LiveAnswer, LiveRoom, LiveValue } from '@/lib/live';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Membership } from '@/lib/types/model';

type Db = SupabaseClient;
interface AnswerRow {
  meeting_date: string;
  activity_id: string;
  member_id: string;
  name: string;
  nick: string;
  side: number | null;
  answer: LiveValue;
  answered_at: string;
}
const toAnswer = (r: AnswerRow): LiveAnswer => ({ act: r.activity_id, member: r.member_id, name: r.name, nick: r.nick, side: r.side === null ? undefined : (r.side as 0 | 1), at: Date.parse(r.answered_at), value: r.answer });

export function supabaseLive(db: Db, org: string, membership: Membership): LiveChannel {
  return {
    async load(night) {
      const [room, answers] = await Promise.all([
        db.from('live_rooms').select('state').eq('org_id', org).eq('meeting_date', night).maybeSingle(),
        db.from('live_answers').select('meeting_date, activity_id, member_id, name, nick, side, answer, answered_at').eq('org_id', org).eq('meeting_date', night)
      ]);
      const state = (room.data as { state: LiveRoom } | null)?.state;
      return { room: state && state.night ? state : null, answers: ((answers.data ?? []) as AnswerRow[]).map(toAnswer) };
    },
    async room(night, room) {
      const r = await db.from('live_rooms').upsert({ org_id: org, meeting_date: night, state: room, updated_at: new Date().toISOString() });
      if (r.error) throw new Error(r.error.message);
    },
    async answer(night, a) {
      if (!membership.membershipId) return;
      const r = await db.from('live_answers').upsert({ org_id: org, meeting_date: night, activity_id: a.act, member_id: membership.membershipId, nick: a.nick, side: a.side ?? null, answer: a.value });
      if (r.error) throw new Error(r.error.message);
    },
    async clear(night) {
      await db.from('live_answers').delete().eq('org_id', org).eq('meeting_date', night);
    },
    async cast(night) {
      const r = await db.rpc('live_cast_start', { p_org: org, p_date: night });
      if (r.error) throw new Error(r.error.message);
      return location.origin + '/c/' + (r.data as string);
    },
    async uncast(night) {
      const r = await db.rpc('live_cast_stop', { p_org: org, p_date: night });
      if (r.error) throw new Error(r.error.message);
    },
    subscribe(night, on) {
      const ch = db
        .channel('live-' + org + '-' + night)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_rooms', filter: 'org_id=eq.' + org }, (payload: { new: unknown }) => {
          const row = payload.new as { meeting_date?: string; state?: LiveRoom } | undefined;
          if (row?.meeting_date === night && row.state?.night) on({ room: row.state });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'live_answers', filter: 'org_id=eq.' + org }, (payload: { new: unknown; eventType?: string }) => {
          if (payload.eventType === 'DELETE') return on({ cleared: true });
          const row = payload.new as AnswerRow | undefined;
          if (row?.meeting_date === night && row.activity_id) on({ answer: toAnswer(row) });
        })
        .subscribe();
      return () => {
        void db.removeChannel(ch);
      };
    }
  };
}
