import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { demoBackend } from '@/lib/data/demo-backend';
import { demoMinistry } from '@/lib/data/seed';
import type { Backend, SyncEvent } from '@/lib/data/backend';
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
