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
          ...(state.entries[key] ?? { rows: [], loading: false, error: null }),
          ...patch,
        },
      },
    })),
}));

export type ListOptions = {
  includeArchived?: boolean;
  limit?: number;
  /** Exact-match server-side filters forwarded verbatim to the API (e.g. `{ parent_id: '...' }`). */
  filters?: Record<string, string>;
};

const cacheKey = (resource: string, workspaceId: string, opts: ListOptions) => {
  const filterPart = opts.filters
    ? Object.entries(opts.filters)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(',')
    : '';
  return `${resource}:${workspaceId}:${opts.includeArchived ? 1 : 0}:${opts.limit ?? 200}:${filterPart}`;
};

const inFlight = new Map<string, Promise<void>>();
const requestVersions = new Map<string, number>();
const cachedQueries = new Map<
  string,
  { resource: ResourceName; workspaceId: string; options: Required<Omit<ListOptions, 'filters'>> & { filters: Record<string, string> } }
>();

function load(resource: ResourceName, workspaceId: string, opts: ListOptions, force = false) {
  const options = {
    includeArchived: opts.includeArchived ?? false,
    limit: opts.limit ?? 200,
    filters: opts.filters ?? {},
  };
  const key = cacheKey(resource, workspaceId, options);
  if (!force && inFlight.has(key)) return inFlight.get(key)!;

  cachedQueries.set(key, { resource, workspaceId, options });
  const requestVersion = (requestVersions.get(key) ?? 0) + 1;
  requestVersions.set(key, requestVersion);
  useCacheStore.getState().set(key, { loading: true, error: null });
  const promise = api
    .list(resource, {
      workspace_id: workspaceId,
      include_archived: options.includeArchived,
      limit: options.limit,
      ...options.filters,
    })
    .then((rows) => {
      if (requestVersions.get(key) === requestVersion) {
        useCacheStore.getState().set(key, { rows: rows as unknown[], loading: false, error: null });
      }
    })
    .catch((cause) => {
      if (requestVersions.get(key) === requestVersion) {
        useCacheStore
          .getState()
          .set(key, { loading: false, error: cause instanceof Error ? cause.message : 'Failed to load' });
      }
    })
    .finally(() => {
      if (inFlight.get(key) === promise) inFlight.delete(key);
    });

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
  const filters = opts.filters ?? {};
  const key = workspaceId ? cacheKey(resource, workspaceId, { includeArchived, limit, filters }) : null;
  const entry = useCacheStore((state) => (key ? state.entries[key] : undefined));

  useEffect(() => {
    if (!workspaceId || !key) return;
    if (!useCacheStore.getState().entries[key]) {
      void load(resource, workspaceId, { includeArchived, limit, filters });
    }
    // All options are folded into `key`; re-running on `key` alone is sufficient.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, workspaceId]);

  return {
    rows: (entry?.rows as T[] | undefined) ?? [],
    loading: entry?.loading ?? Boolean(workspaceId),
    error: entry?.error ?? null,
    refresh: () => workspaceId && void load(resource, workspaceId, { includeArchived, limit, filters }, true),
  };
}

/** Invalidate a cached resource (e.g. after a create/update) so the next read refetches it. */
export function invalidateList(resource: ResourceName, workspaceId: string) {
  for (const query of cachedQueries.values()) {
    if (query.resource === resource && query.workspaceId === workspaceId) {
      void load(query.resource, query.workspaceId, query.options, true);
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
