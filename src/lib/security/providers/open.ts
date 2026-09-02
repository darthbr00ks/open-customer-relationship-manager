import { OpenPermissionSet } from '../permission-set';
import type { PermissionProvider, PermissionSet } from '../types';

/**
 * Grants everything.
 *
 * What a fresh clone runs on, and the same role `DevAuthProvider` and
 * `ConsoleEmailProvider` play for their interfaces: a second implementation
 * that is not a mock, so `PermissionProvider` cannot quietly grow a shape only
 * the profile tables can satisfy.
 *
 * Unlike those two it is safe in production — a deployment can legitimately
 * decide that everyone who can sign in may do everything, which is the right
 * answer for a single-team CRM and the behaviour this app had before profiles
 * existed.
 */
export class OpenPermissionProvider implements PermissionProvider {
  readonly id = 'open';
  readonly label = 'No restrictions';
  readonly enforces = false;

  isConfigured(): boolean {
    return true;
  }

  async permissionsFor(): Promise<PermissionSet> {
    return new OpenPermissionSet();
  }
}
