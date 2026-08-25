'use client';

import { useEffect } from 'react';
import { create } from 'zustand';

import { api } from '@/lib/api-client';
import type { ResourceName } from '@/lib/api/resources';

/**
 * An in-memory, per-tab cache of resource pages, shared by every component
 * that reads a given resource in a given workspace.
 *
 * The API has no server-side joins, so rendering a lookup ("Deal → Entity
 * name"), a related list ("People at this Entity"), or the command palette
 * all mean fetching a second resource's rows client-side. Without a shared
 * cache, five components on one page showing entity names would each fetch
 * the entities list separately. `useCachedList` dedupes concurrent requests
 * for the same key and lets every reader share one fetch.
 */

type Entry = {
  rows: unknown[];
  loading: boolean;
  error: string | null;
  loadedAt: number;
};

type CacheState = {
  entries: Record<string, Entry>;
  set: (key: string, patch: Partial<Entry>) => void;
};

const useCacheStore = create<CacheState>((set) => ({
  entries: {},
  set: (key, patch) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [key]: {
          ...(state.entries[key] ?? { rows: [], loading: false, error: null, loadedAt: 0 }),
          ...patch,
        },
      },
    })),
}));

export type ListOptions = { includeArchived?: boolean; limit?: number };

const cacheKey = (resource: string, workspaceId: string, opts: ListOptions) =>
  `${resource}:${workspaceId}:${opts.includeArchived ? 1 : 0}:${opts.limit ?? 200}`;

const inFlight = new Map<string, Promise<void>>();

function load(resource: ResourceName, workspaceId: string, opts: ListOptions, force = false) {
  const key = cacheKey(resource, workspaceId, opts);
  if (!force && inFlight.has(key)) return inFlight.get(key)!;

  useCacheStore.getState().set(key, { loading: true, error: null });
  const promise = api
    .list(resource, {
      workspace_id: workspaceId,
      include_archived: opts.includeArchived ?? false,
      limit: opts.limit ?? 200,
    })
    .then((rows) => {
      useCacheStore.getState().set(key, { rows: rows as unknown[], loading: false, error: null, loadedAt: Date.now() });
    })
    .catch((cause) => {
      useCacheStore
        .getState()
        .set(key, { loading: false, error: cause instanceof Error ? cause.message : 'Failed to load' });
    })
    .finally(() => inFlight.delete(key));

  inFlight.set(key, promise);
  return promise;
}

/** Fetch (once, then cached) up to `limit` rows of a resource for the current workspace. */
export function useCachedList<T>(
  resource: ResourceName,
  workspaceId: string | null,
  opts: ListOptions = {},
) {
  const includeArchived = opts.includeArchived ?? false;
  const limit = opts.limit ?? 200;
  const key = workspaceId ? cacheKey(resource, workspaceId, { includeArchived, limit }) : null;
  const entry = useCacheStore((state) => (key ? state.entries[key] : undefined));

  useEffect(() => {
    if (!workspaceId || !key) return;
    if (!useCacheStore.getState().entries[key]) {
      void load(resource, workspaceId, { includeArchived, limit });
    }
    // `resource`/`includeArchived`/`limit` are folded into `key`; re-running on `key` alone is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, workspaceId]);

  return {
    rows: (entry?.rows as T[] | undefined) ?? [],
    loading: entry?.loading ?? Boolean(workspaceId),
    error: entry?.error ?? null,
    refresh: () => workspaceId && void load(resource, workspaceId, { includeArchived, limit }, true),
  };
}

/** Invalidate a cached resource (e.g. after a create/update) so the next read refetches it. */
export function invalidateList(resource: ResourceName, workspaceId: string) {
  for (const includeArchived of [false, true]) {
    for (const limit of [50, 200]) {
      const key = cacheKey(resource, workspaceId, { includeArchived, limit });
      if (useCacheStore.getState().entries[key]) {
        void load(resource, workspaceId, { includeArchived, limit }, true);
      }
    }
  }
}

/** Build an id → row lookup map out of a cached list, for resolving `*_id` foreign keys. */
export function useLookupMap<T extends { id: string }>(
  resource: ResourceName,
  workspaceId: string | null,
) {
  const { rows, loading } = useCachedList<T>(resource, workspaceId, { includeArchived: true });
  const map = new Map(rows.map((row) => [row.id, row] as const));
  return { map, loading };
}
