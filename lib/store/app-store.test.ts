import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoBackend } from '@/lib/data/demo-backend';
import { demoMinistry } from '@/lib/data/seed';
import type { Backend, SyncEvent } from '@/lib/data/backend';
import { sendNightReports } from '@/lib/store/actions';
import { createAppStore } from '@/lib/store/app-store';
import type { Membership } from '@/lib/types/model';

const leader: Membership = {
  mode: 'supabase', persona: 'leader', role: 'leader', displayName: 'Pastor Mike', firstName: 'Mike',
  initials: 'MT', membershipId: 'm1', orgId: 'org-1', teamId: null, studentName: null
};

/* A backend whose document saves fail while `down` is set. */
function flaky() {
  const sent: SyncEvent[] = [];
  const state = { down: false };
  const backend: Backend = {
    ...demoBackend,
    mode: 'supabase',
    saveSnapshot: () => {},
    sync: async (e) => {
      if (state.down) throw new Error('offline');
      sent.push(e);
    }
  };
  return { backend, sent, state };
}

const docs = (sent: SyncEvent[]) => sent.flatMap((e) => (e.kind === 'doc' ? [e] : []));

describe('documents whose save couldn’t go', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('are saved again, from the newest copy, when the phone is back online', () => {
    const { backend, sent } = flaky();
    const store = createAppStore(backend, leader, demoMinistry());
    store.getState().toggleOfflineSim();
    store.getState().mutate((d) => void (d.plan.settings.church = 'Grace'));
    store.getState().emit({ kind: 'doc', key: 'plan', value: store.getState().data.plan });
    store.getState().mutate((d) => void (d.plan.settings.church = 'Grace Church'));
    store.getState().emit({ kind: 'doc', key: 'plan', value: store.getState().data.plan });
    expect(docs(sent)).toHaveLength(0);
    expect(store.getState().unsavedDocs).toEqual(['plan']);

    store.getState().toggleOfflineSim();
    expect(docs(sent)).toHaveLength(1);
    expect(docs(sent)[0]).toMatchObject({ key: 'plan', value: { settings: { church: 'Grace Church' } } });
    expect(store.getState().unsavedDocs).toEqual([]);
  });

  it('are tried again on their own after a save fails with signal', async () => {
    const { backend, sent, state } = flaky();
    const store = createAppStore(backend, leader, demoMinistry());
    state.down = true;
    store.getState().emit({ kind: 'doc', key: 'plan', value: store.getState().data.plan });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().unsavedDocs).toEqual(['plan']);

    state.down = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(docs(sent)).toHaveLength(1);
    expect(store.getState().unsavedDocs).toEqual([]);
  });

  it('keep waiting while saves keep failing', async () => {
    const { backend, sent, state } = flaky();
    const store = createAppStore(backend, leader, demoMinistry());
    state.down = true;
    store.getState().emit({ kind: 'doc', key: 'plan', value: store.getState().data.plan });
    await vi.advanceTimersByTimeAsync(15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(store.getState().unsavedDocs).toEqual(['plan']);
    expect(docs(sent)).toHaveLength(0);
  });

  it('record when a document last saved, only once the save lands', async () => {
    const { backend, state } = flaky();
    const store = createAppStore(backend, leader, demoMinistry());
    state.down = true;
    store.getState().emit({ kind: 'doc', key: 'plan', value: store.getState().data.plan });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().docSavedAt.plan).toBeUndefined();
    state.down = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(store.getState().docSavedAt.plan).toBeTypeOf('number');
  });

  it('don’t include other writes, which aren’t queued', async () => {
    const { backend, state } = flaky();
    const store = createAppStore(backend, leader, demoMinistry());
    state.down = true;
    store.getState().emit({ kind: 'careDone', id: 'c1' });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().unsavedDocs).toEqual([]);
  });
});

describe('ministry settings changed without signal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  const configs = (sent: SyncEvent[]) => sent.flatMap((e) => (e.kind === 'config' ? [e] : []));

  it('are held and sent once, as they stand, when the signal comes back', () => {
    const { backend, sent } = flaky();
    const store = createAppStore(backend, leader, demoMinistry());
    store.getState().toggleOfflineSim();
    store.getState().mutate((d) => void (d.config.gameName = 'Capture the flag'));
    store.getState().emit({ kind: 'config', config: store.getState().data.config });
    store.getState().mutate((d) => void (d.config.gameName = 'Pipeline relay'));
    store.getState().emit({ kind: 'config', config: store.getState().data.config });
    expect(configs(sent)).toHaveLength(0);
    expect(store.getState().unsavedConfig).toBe(true);

    store.getState().toggleOfflineSim();
    expect(configs(sent)).toHaveLength(1);
    expect(configs(sent)[0].config.gameName).toBe('Pipeline relay');
    expect(store.getState().unsavedConfig).toBe(false);
  });

  it('are tried again after a save fails with signal', async () => {
    const { backend, sent, state } = flaky();
    const store = createAppStore(backend, leader, demoMinistry());
    state.down = true;
    store.getState().emit({ kind: 'config', config: store.getState().data.config });
    await vi.advanceTimersByTimeAsync(0);
    expect(store.getState().unsavedConfig).toBe(true);
    state.down = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(configs(sent)).toHaveLength(1);
    expect(store.getState().unsavedConfig).toBe(false);
  });
});

describe('keeping the data', () => {
  it('keeps a line logged right after a change, not only the change', () => {
    const snaps: string[][] = [];
    const backend: Backend = { ...demoBackend, saveSnapshot: (d) => void snaps.push(d.activityLog.map((a) => a.line)) };
    const store = createAppStore(backend, leader, demoMinistry());
    store.getState().mutate((d) => void (d.config.gameName = 'Sock wars'));
    store.getState().logActivity('Renamed the game');
    expect(snaps[snaps.length - 1]).toContain('Renamed the game');
  });
});

describe('an audit line the database writes itself', () => {
  it('shows on the phone but isn’t sent twice on a live ministry', async () => {
    const { backend, sent } = flaky();
    const store = createAppStore(backend, leader, demoMinistry());
    store.getState().logActivity('Approved Sam Ortiz as Coach', true);
    store.getState().logActivity('Edited the run sheet');
    await Promise.resolve();
    expect(store.getState().data.activityLog.slice(0, 2).map((l) => l.line)).toEqual(['Edited the run sheet', 'Approved Sam Ortiz as Coach']);
    expect(sent.flatMap((e) => (e.kind === 'activity' ? [e.line.line] : []))).toEqual(['Edited the run sheet']);
  });
});

describe('an undo after the night closed', () => {
  it('reaches leaders as a correction notice', async () => {
    const { backend } = flaky();
    const d = demoMinistry();
    const store = createAppStore(backend, leader, d);
    store.getState().award({ team: d.teams[0].id, cat: d.cats[0].id, amount: 300, why: 'won the relay', by: 'Pastor Mike' });
    store.getState().mutate((x) => {
      x.huddle.nightClosed = true;
      x.huddle.closedAt = Date.now() + 1;
    });
    await new Promise((r) => setTimeout(r, 5));
    store.getState().undoLast();
    expect(store.getState().data.activityLog[0].line).toMatch(/^Correction notice: −300 /);
    expect(store.getState().toast?.msg).toMatch(/correction notice/);
  });
});

describe('closing the night', () => {
  it('sends the night-close reports once, however many times it is closed', () => {
    const { backend } = flaky();
    const d = demoMinistry();
    d.deliveries = [
      { id: 'c1', report: 'standings', audience: 'leaders', scope: 'all', cadence: 'close', day: 0, time: '21:00', on: true },
      { id: 'w1', report: 'roster', audience: 'leaders', scope: 'all', cadence: 'weekly', day: 4, time: '09:00', on: true }
    ];
    const store = createAppStore(backend, { ...leader, mode: 'demo' }, d);
    expect(sendNightReports(store.getState)).toBe(1);
    expect(store.getState().data.reportSendLog[0]).toMatchObject({ delivery: 'c1', period: 'c:' + d.tonight.date });
    expect(sendNightReports(store.getState)).toBe(0);
  });
});

describe('a season with no points', () => {
  it('takes no points by any road, and still records who came', () => {
    const { backend } = flaky();
    const d = demoMinistry();
    d.config = { ...d.config, scoring: false, seasonName: 'Summer 2027' };
    const store = createAppStore(backend, leader, d);
    const before = store.getState().data.ledger.length;
    expect(store.getState().award({ team: d.teams[0].id, cat: 'general', amount: 100, why: 'test' })).toBeNull();
    expect(store.getState().toast?.msg).toBe('No points this season — Summer 2027 runs as regular programming.');
    const team = d.teams[0].id;
    store.getState().markAllPresent(team, true);
    expect(store.getState().postAttendance(team)).toBe('posted');
    expect(store.getState().data.ledger.length).toBe(before);
    expect(store.getState().data.tonight.checkinPosted[team]).toMatchObject({ held: false });
    expect(store.getState().toast?.msg).toMatch(/checked in\. No points this season — attendance is on the record\.$/);
  });
});

describe('pulling Home to refresh', () => {
  it('reads the ministry again — but never over changes this phone hasn’t saved', async () => {
    const { backend } = flaky();
    const fresh = demoMinistry();
    fresh.config = { ...fresh.config, ministryName: 'Grace Students (renamed)' };
    const store = createAppStore({ ...backend, load: async () => fresh }, leader, demoMinistry());
    store.setState({ unsavedConfig: true });
    expect(await store.getState().reload()).toBe(false);
    expect(store.getState().data.config.ministryName).toBe('Grace Community Students');
    store.setState({ unsavedConfig: false });
    expect(await store.getState().reload()).toBe(true);
    expect(store.getState().data.config.ministryName).toBe('Grace Students (renamed)');
    expect(store.getState().toast?.msg).toBe('Home refreshed.');
  });
});
