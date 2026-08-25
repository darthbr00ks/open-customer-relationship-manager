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

function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: build a UUIDv4 from getRandomValues when randomUUID is unavailable.
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    // Last-resort: Math.random (not cryptographically secure but avoids a throw).
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return [...bytes]
    .map((b, i) => ([4, 6, 8, 10].includes(i) ? '-' : '') + b.toString(16).padStart(2, '0'))
    .join('');
}

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
