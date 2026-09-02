import { authEnabled } from '@/lib/auth/registry';

import { OpenPermissionProvider } from './providers/open';
import { ProfilePermissionProvider } from './providers/profiles';
import type { PermissionContext, PermissionProvider, PermissionSet } from './types';

/**
 * Where the permission backend is chosen.
 *
 * Adding one means a class against `PermissionProvider` and a line here.
 */

const PROVIDERS: Record<string, () => PermissionProvider> = {
  profiles: () => new ProfilePermissionProvider(),
  open: () => new OpenPermissionProvider(),
};

const cache = new Map<string, PermissionProvider>();

export const PERMISSION_PROVIDER_IDS = Object.keys(PROVIDERS);

/**
 * `PERMISSIONS_PROVIDER` wins when set. Otherwise profiles are enforced exactly
 * when there is someone to enforce them against: with no identity provider
 * every caller is anonymous, so a profile could never be looked up and the only
 * honest answer is to grant everything.
 */
export function configuredPermissionProviderId(): string {
  const configured = process.env.PERMISSIONS_PROVIDER?.trim();
  if (configured) return configured;
  return authEnabled() ? 'profiles' : 'open';
}

export function permissionProvider(id: string = configuredPermissionProviderId()): PermissionProvider {
  const cached = cache.get(id);
  if (cached) return cached;

  const factory = PROVIDERS[id];
  if (!factory) {
    throw new Error(
      `Unknown permission provider "${id}". Known providers: ${PERMISSION_PROVIDER_IDS.join(', ')}.`,
    );
  }

  const provider = factory();
  cache.set(id, provider);
  return provider;
}

/** Whether this deployment restricts anything at all. */
export const permissionsEnforced = (): boolean => permissionProvider().enforces;

/** The caller's permissions, from whichever provider is configured. */
export const permissionsFor = (context: PermissionContext): Promise<PermissionSet> =>
  permissionProvider().permissionsFor(context);
