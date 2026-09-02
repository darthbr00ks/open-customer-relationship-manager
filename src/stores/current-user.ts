'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Who is using this browser right now.
 *
 * Two sources feed it, and every screen reads the same `userId` /
 * `displayName` either way:
 *
 * - **Signed in.** `SessionProvider` calls `adoptSession` with what
 *   `/api/auth/session` reports, so `userId` is the `app_user` uuid the
 *   identity provider's subject maps to and the name is the one it holds.
 * - **No identity provider configured.** The original behaviour: a name typed
 *   into the user menu and a uuid generated once per browser, both persisted
 *   locally. Not an identity, and not a security boundary — it exists so owner
 *   assignment and activity attribution work on a laptop with no Auth0 tenant.
 *
 * The local identity is kept alongside the session rather than overwritten, so
 * signing out returns to it instead of minting a new uuid and orphaning every
 * "My records" view.
 */
type CurrentUserState = {
  /** The id stamped on writes — session or local, whichever is in force. */
  userId: string;
  displayName: string;
  /** The per-browser stand-in, used whenever nobody is signed in. */
  localUserId: string;
  localDisplayName: string;
  /** Whether this deployment requires signing in at all. */
  authEnabled: boolean;
  signedIn: boolean;
  setDisplayName: (name: string) => void;
  adoptSession: (session: { user_id: string; name: string; auth_enabled: boolean }) => void;
  /** Fall back to the local identity — no session, or signed out. */
  clearSession: (authEnabled: boolean) => void;
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
    (set, get) => {
      const localUserId = makeId();
      return {
        userId: localUserId,
        displayName: 'You',
        localUserId,
        localDisplayName: 'You',
        authEnabled: false,
        signedIn: false,

        // Editing the name is meaningless once a provider owns it, so a signed-in
        // user's change is ignored rather than silently diverging from the IdP.
        setDisplayName: (name) => {
          if (get().signedIn) return;
          const displayName = name.trim() || 'You';
          set({ displayName, localDisplayName: displayName });
        },

        adoptSession: (session) =>
          set({
            userId: session.user_id,
            displayName: session.name,
            authEnabled: session.auth_enabled,
            signedIn: true,
          }),

        clearSession: (authEnabled) =>
          set((state) => ({
            userId: state.localUserId,
            displayName: state.localDisplayName,
            authEnabled,
            signedIn: false,
          })),
      };
    },
    {
      name: 'open-rm-user',
      // Only the local identity is persisted. Session fields come from the
      // server on every load, so a stale cookie can never leave the UI showing
      // someone as signed in when they are not.
      partialize: (state) => ({
        localUserId: state.localUserId,
        localDisplayName: state.localDisplayName,
      }),
      // `localUserId` is generated once on first run and must not be replaced by
      // a fresh random value if `persist` ever re-runs the initializer. Until
      // `SessionProvider` reports in, the local identity is also the active one.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<CurrentUserState>;
        // `userId` / `displayName` are what earlier versions persisted under
        // this key; reading them keeps an existing browser's identity — and so
        // the records it already owns — across the upgrade.
        const localUserId = saved.localUserId ?? saved.userId ?? current.localUserId;
        const localDisplayName = saved.localDisplayName ?? saved.displayName ?? current.localDisplayName;
        return { ...current, localUserId, localDisplayName, userId: localUserId, displayName: localDisplayName };
      },
    },
  ),
);
