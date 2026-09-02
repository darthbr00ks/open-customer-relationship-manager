/**
 * The browser's view of permissions.
 *
 * Two jobs, and it is worth being clear that only the first is a feature:
 *
 * 1. **Honesty.** Hide a column nobody may read and disable an action that
 *    would only ever come back 403. A UI that offers what the server will
 *    refuse is a UI that makes people think the app is broken.
 * 2. **Nothing else.** The server decides. Everything here is re-checked in
 *    `src/lib/security/guard.ts`, and a client that lied to itself would gain
 *    exactly nothing.
 */

import { ApiError } from '@/lib/api-client';

import type { FieldAccess, ObjectAction } from './types';

export type EffectivePermissions = {
  /** False when nothing is being enforced — no profiles, or the open provider. */
  enforced: boolean;
  profile: { id: string; name: string; key: string; is_admin: boolean } | null;
  objects: Record<string, Record<ObjectAction, boolean>>;
  /** Only the restricted ones; anything absent is fully editable. */
  fields: Record<string, Record<string, 'hidden' | 'read'>>;
};

export type PermissionCatalog = {
  objects: { object_key: string; label: string; fields: string[] }[];
};

export type ProfileSummary = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  is_admin: boolean;
  is_default: boolean;
  created_at: string;
};

export type ProfileGrants = {
  objects: Record<string, Record<ObjectAction, boolean>>;
  fields: Record<string, Record<string, FieldAccess>>;
};

export type ProfileDetail = ProfileSummary & {
  assigned_users: number;
  grants: ProfileGrants;
};

export type ProfileListing = {
  provider: { id: string; label: string; enforces: boolean };
  /** False when this workspace has never set profiles up, so everything is permitted. */
  configured: boolean;
  profiles: ProfileSummary[];
};

export type UserAssignment = {
  user_id: string;
  name: string | null;
  email: string | null;
  last_login_at: string | null;
  profile_id: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body?.detail ?? response.statusText);
  }
  return body as T;
}

const scoped = (path: string, workspaceId: string) =>
  `${path}${path.includes('?') ? '&' : '?'}workspace_id=${encodeURIComponent(workspaceId)}`;

export const fetchEffectivePermissions = (workspaceId: string) =>
  request<EffectivePermissions>(scoped('/api/v1/permissions/me', workspaceId));

export const fetchPermissionCatalog = () =>
  request<PermissionCatalog>('/api/v1/permissions/catalog');

export const fetchProfiles = (workspaceId: string) =>
  request<ProfileListing>(scoped('/api/v1/profiles', workspaceId));

export const fetchProfile = (workspaceId: string, id: string) =>
  request<ProfileDetail>(scoped(`/api/v1/profiles/${id}`, workspaceId));

export const createProfile = (body: Record<string, unknown>) =>
  request<ProfileSummary>('/api/v1/profiles', { method: 'POST', body: JSON.stringify(body) });

export const updateProfile = (workspaceId: string, id: string, body: Record<string, unknown>) =>
  request<ProfileSummary>(scoped(`/api/v1/profiles/${id}`, workspaceId), {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const archiveProfile = (workspaceId: string, id: string) =>
  request<ProfileSummary>(scoped(`/api/v1/profiles/${id}`, workspaceId), { method: 'DELETE' });

export const saveGrants = (workspaceId: string, id: string, grants: ProfileGrants) =>
  request<ProfileDetail>(scoped(`/api/v1/profiles/${id}/permissions`, workspaceId), {
    method: 'PUT',
    body: JSON.stringify(grants),
  });

export const setUpProfiles = (workspaceId: string) =>
  request<{ profiles: ProfileSummary[] }>('/api/v1/profiles/bootstrap', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId }),
  });

export const fetchAssignments = (workspaceId: string) =>
  request<{ users: UserAssignment[] }>(scoped('/api/v1/profile-assignments', workspaceId));

export const assignProfile = (workspaceId: string, userId: string, profileId: string | null) =>
  request<{ user_id: string; profile_id: string | null }>('/api/v1/profile-assignments', {
    method: 'POST',
    body: JSON.stringify({ workspace_id: workspaceId, user_id: userId, profile_id: profileId }),
  });
