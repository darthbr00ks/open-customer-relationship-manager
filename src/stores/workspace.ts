'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { DEMO_WORKSPACE_ID } from '@/lib/demo-workspace';

/**
 * The workspace every screen reads and writes through.
 *
 * Persisted so a reload keeps the user in the workspace they were looking at.
 * There is no authentication yet, so this is a scoping choice, not a security
 * boundary. Defaults to the seed script's workspace so a fresh install shows
 * data immediately rather than an empty app with no workspace selected.
 */
type WorkspaceState = {
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
  clear: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceId: DEMO_WORKSPACE_ID,
      setWorkspaceId: (id) => set({ workspaceId: id }),
      clear: () => set({ workspaceId: null }),
    }),
    { name: 'open-rm-workspace' },
  ),
);
