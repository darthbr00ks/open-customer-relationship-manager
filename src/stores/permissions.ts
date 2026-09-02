'use client';

import { create } from 'zustand';

import { fetchEffectivePermissions, type EffectivePermissions } from '@/lib/security/client';
import type { ObjectAction } from '@/lib/security/types';

/**
 * The caller's own permissions, for the UI to be honest with.
 *
 * A store rather than a hook-with-fetch because everything asks: the nav asks
 * which tabs to show, a list asks which columns, a record header asks which
 * buttons, and every field asks whether it is visible. One fetch per workspace,
 * shared — the same reasoning as `data-cache.ts`.
 *
 * Until it has loaded, everything is permitted. The alternative is a flash of
 * an empty app on every page load, and the server is the authority regardless:
 * a request that should not have been offered comes back 403.
 */

type PermissionsState = {
  workspaceId: string | null;
  permissions: EffectivePermissions | null;
  loading: boolean;
  load: (workspaceId: string) => Promise<void>;
  /** Re-read after an administrator changes a profile. */
  refresh: () => Promise<void>;
};

const inFlight = new Map<string, Promise<void>>();

export const usePermissionsStore = create<PermissionsState>()((set, get) => ({
  workspaceId: null,
  permissions: null,
  loading: false,

  load: async (workspaceId: string) => {
    if (get().workspaceId === workspaceId && (get().permissions || get().loading)) return;

    const pending = inFlight.get(workspaceId);
    if (pending) return pending;

    set({ workspaceId, permissions: null, loading: true });

    const promise = fetchEffectivePermissions(workspaceId)
      .then((permissions) => {
        // A workspace switch mid-flight must not overwrite the new one.
        if (get().workspaceId === workspaceId) set({ permissions, loading: false });
      })
      .catch(() => {
        // Leave `permissions` null, which reads as "everything permitted" — the
        // server still refuses anything it should.
        if (get().workspaceId === workspaceId) set({ loading: false });
      })
      .finally(() => inFlight.delete(workspaceId));

    inFlight.set(workspaceId, promise);
    return promise;
  },

  refresh: async () => {
    const workspaceId = get().workspaceId;
    if (!workspaceId) return;
    set({ permissions: null });
    inFlight.delete(workspaceId);
    await get().load(workspaceId);
  },
}));

/* -------------------------------------------------------------------------- */
/* Reading the answer                                                          */
/* -------------------------------------------------------------------------- */

/**
 * These take the loaded permissions rather than reading the store themselves,
 * so they can be called from render loops and from plain functions alike, and
 * so they are trivially testable.
 */

export function canDo(
  permissions: EffectivePermissions | null,
  objectKey: string,
  action: ObjectAction,
): boolean {
  if (!permissions?.enforced) return true;
  return permissions.objects[objectKey]?.[action] ?? false;
}

export function fieldIsVisible(
  permissions: EffectivePermissions | null,
  objectKey: string,
  fieldKey: string,
): boolean {
  if (!permissions?.enforced) return true;
  return permissions.fields[objectKey]?.[fieldKey] !== 'hidden';
}

export function fieldIsEditable(
  permissions: EffectivePermissions | null,
  objectKey: string,
  fieldKey: string,
): boolean {
  if (!permissions?.enforced) return true;
  // Anything absent from `fields` is unrestricted, so the object's own edit
  // grant is the only remaining question.
  if (permissions.fields[objectKey]?.[fieldKey]) return false;
  return canDo(permissions, objectKey, 'edit');
}

/** Hook form, for components that only need one answer. */
export const usePermissions = () => usePermissionsStore((state) => state.permissions);
