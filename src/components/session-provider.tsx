'use client';

import { useEffect } from 'react';

import { useCurrentUserStore } from '@/stores/current-user';

/**
 * Tells the client who is signed in.
 *
 * The session cookie is http-only — that is the point of it — so the browser
 * cannot read it and has to ask. One fetch on mount, straight into
 * `useCurrentUserStore`, so every screen that already reads `userId` /
 * `displayName` picks up the real user with no change of its own.
 *
 * Renders nothing, like `ThemeProvider`. A failed fetch leaves the local
 * identity in place: the CRM working with the wrong name in the corner beats
 * the CRM not loading.
 */
export function SessionProvider() {
  const adoptSession = useCurrentUserStore((state) => state.adoptSession);
  const clearSession = useCurrentUserStore((state) => state.clearSession);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (!response.ok) return;

        const payload = (await response.json()) as {
          auth_enabled: boolean;
          user: { id: string; name: string } | null;
        };
        if (cancelled) return;

        if (payload.user) {
          adoptSession({
            user_id: payload.user.id,
            name: payload.user.name,
            auth_enabled: payload.auth_enabled,
          });
        } else {
          clearSession(payload.auth_enabled);
        }
      } catch {
        // Offline, or the app is being torn down mid-request. Neither is worth
        // interrupting the user over.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [adoptSession, clearSession]);

  return null;
}
