'use client';

import { useEffect } from 'react';

import { usePermissionsStore } from '@/stores/permissions';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Loads the caller's effective permissions for the current workspace.
 *
 * Keyed on the workspace because permissions are per workspace: the same person
 * can be an administrator in one and read-only in another, so switching has to
 * re-read rather than carry the old answer across.
 *
 * Renders nothing, like `ThemeProvider` and `SessionProvider`.
 */
export function PermissionsProvider() {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const load = usePermissionsStore((state) => state.load);

  useEffect(() => {
    if (workspaceId) void load(workspaceId);
  }, [workspaceId, load]);

  return null;
}
