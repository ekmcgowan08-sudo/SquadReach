'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { demoBackend } from '@/lib/data/demo-backend';
import { demoMinistry } from '@/lib/data/seed';
import { supabaseBackend } from '@/lib/data/supabase-backend';
import { createAppStore, type AppState, type AppStore } from '@/lib/store/app-store';
import type { Persona } from '@/lib/types/domain';
import type { Membership } from '@/lib/types/model';

const StoreCtx = createContext<AppStore | null>(null);
const RolesCtx = createContext<Persona[]>([]);

export function AppProvider({ membership, roles, children }: { membership: Membership; roles: Persona[]; children: ReactNode }) {
  const [store] = useState(() =>
    createAppStore(membership.mode === 'supabase' ? supabaseBackend(membership) : demoBackend, membership, demoMinistry())
  );

  /* The server re-resolves who you are on every navigation (a role switch
     sets a cookie and refreshes). Follow it. */
  useEffect(() => {
    store.getState().setMembership(membership);
  }, [store, membership]);

  useEffect(() => {
    const st = store.getState();
    let alive = true;
    st.backend
      .load()
      .then((data) => {
        if (!alive) return;
        store.getState().hydrate(data);
        /* Read held work only AFTER the snapshot loads — restoring it first
           would be clobbered by the snapshot. */
        return store.getState().restoreHeld();
      })
      .catch(() => {
        store.getState().hydrate(demoMinistry());
        store.getState().say('Could not reach the ministry’s data. Showing what this phone has.');
      });

    const online = () => store.getState().setNetOnline(true);
    const offline = () => store.getState().setNetOnline(false);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) offline();
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);

    /* A backgrounded tab never gets another render: pagehide and
       visibilitychange are the last guaranteed ticks. Write-only. */
    const lastTick = () => store.getState().persistHeld(true);
    const onVis = () => document.visibilityState === 'hidden' && lastTick();
    window.addEventListener('pagehide', lastTick);
    document.addEventListener('visibilitychange', onVis);

    const unsub = st.backend.subscribe((patch) => {
      const s = store.getState();
      if (patch.kind === 'entries') {
        s.mutate((d) => {
          for (const e of patch.entries) {
            const i = d.ledger.findIndex((x) => x.id === e.id);
            if (i >= 0) d.ledger[i] = e;
            else d.ledger.unshift(e);
          }
        });
      } else if (patch.kind === 'huddle') {
        s.mutate((d) => {
          d.huddle = patch.huddle;
        });
      } else if (patch.kind === 'game') {
        s.mutate((d) => {
          d.game = patch.game;
        });
      } else {
        void s.backend.load().then((data) => store.getState().hydrate(data));
      }
    });

    return () => {
      alive = false;
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('pagehide', lastTick);
      document.removeEventListener('visibilitychange', onVis);
      lastTick();
      unsub();
    };
  }, [store]);

  return (
    <StoreCtx.Provider value={store}>
      <RolesCtx.Provider value={roles}>{children}</RolesCtx.Provider>
    </StoreCtx.Provider>
  );
}

function useStoreApi() {
  const s = useContext(StoreCtx);
  if (!s) throw new Error('useApp outside AppProvider');
  return s;
}

/** Select a slice of the app state. Return primitives or stable references. */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(useStoreApi(), selector);
}

/** Select several values at once (shallow-compared). */
export function useAppShallow<T extends object>(selector: (s: AppState) => T): T {
  return useStore(useStoreApi(), useShallow(selector));
}

/** Imperative access for event handlers. */
export function useAppApi() {
  return useStoreApi().getState;
}

export function useApprovedRoles() {
  return useContext(RolesCtx);
}
