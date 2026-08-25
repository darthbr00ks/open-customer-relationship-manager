'use client';

import { useCallback } from 'react';

import { demoUserName } from '@/lib/demo-users';
import { useCurrentUserStore } from '@/stores/current-user';

/** Resolves a `*_user_id` column to a display name — "you", a demo user, or a short id as a last resort. */
export function useUserLabel() {
  const userId = useCurrentUserStore((state) => state.userId);
  const displayName = useCurrentUserStore((state) => state.displayName);

  return useCallback(
    (id: string | null | undefined) => {
      if (!id) return '—';
      if (id === userId) return displayName;
      return demoUserName(id) ?? `User ${id.slice(0, 8)}`;
    },
    [userId, displayName],
  );
}
