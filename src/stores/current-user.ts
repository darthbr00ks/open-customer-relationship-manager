'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Stand-in for authentication, which this app does not have yet (see
 * README "Known gaps"). A display name and a stable id let the UI stamp
 * `owner_user_id` / `created_by_user_id` on writes, attribute activity
 * ("Hector added a note"), and power "My records" saved views — all without
 * pretending there is a real login. Editable from the user menu.
 */
type CurrentUserState = {
  userId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
};

const makeId = () => (typeof crypto !== 'undefined' ? crypto.randomUUID() : '');

export const useCurrentUserStore = create<CurrentUserState>()(
  persist(
    (set) => ({
      userId: makeId(),
      displayName: 'You',
      setDisplayName: (name) => set({ displayName: name.trim() || 'You' }),
    }),
    {
      name: 'open-rm-user',
      // `userId` is generated once on first run and must not be replaced by a
      // fresh random value if `persist` ever re-runs the initializer.
      merge: (persisted, current) => ({ ...current, ...(persisted as Partial<CurrentUserState>) }),
    },
  ),
);
