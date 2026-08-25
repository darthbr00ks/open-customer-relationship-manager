'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ObjectKey } from '@/lib/objects';

/** One filter predicate. `'$me'` on a `user` field resolves to the current browser's user id at query time. */
export type ViewFilter = { field: string; equals: string };

export type SavedView = {
  id: string;
  objectKey: ObjectKey;
  name: string;
  filters: ViewFilter[];
  sort: { field: string; direction: 'asc' | 'desc' };
  columns: string[];
  includeArchived: boolean;
  /** Built-in views (All / Mine) can't be renamed or deleted. */
  builtin?: boolean;
};

type SavedViewsState = {
  views: SavedView[];
  active: Partial<Record<ObjectKey, string>>;
  addView: (view: SavedView) => void;
  updateView: (id: string, patch: Partial<SavedView>) => void;
  removeView: (id: string) => void;
  setActive: (objectKey: ObjectKey, id: string) => void;
};

/**
 * Saved list views (spec §3), stored per browser. There's no auth or a
 * concept of a shared workspace user base yet, so — unlike the rest of this
 * app's data — these live client-side rather than as a new resource; a
 * single-user local install has no one else to share them with, and it
 * keeps "click to save a view" from requiring a schema migration.
 */
export const useSavedViewsStore = create<SavedViewsState>()(
  persist(
    (set) => ({
      views: [],
      active: {},
      addView: (view) => set((state) => ({ views: [...state.views, view] })),
      updateView: (id, patch) =>
        set((state) => ({ views: state.views.map((view) => (view.id === id ? { ...view, ...patch } : view)) })),
      removeView: (id) => set((state) => ({ views: state.views.filter((view) => view.id !== id) })),
      setActive: (objectKey, id) => set((state) => ({ active: { ...state.active, [objectKey]: id } })),
    }),
    { name: 'open-rm-saved-views' },
  ),
);
