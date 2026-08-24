'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The workspace every screen reads and writes through.
 *
 * Persisted so a reload keeps the user in the workspace they were looking at.
 * There is no authentication yet, so this is a scoping choice, not a security
 * boundary.
 */
type WorkspaceState = {
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
  clear: () => void;
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceId: null,
      setWorkspaceId: (id) => set({ workspaceId: id }),
      clear: () => set({ workspaceId: null }),
    }),
    { name: 'open-rm-workspace' },
  ),
);
