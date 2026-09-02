import { z } from 'zod';

import { fail } from '@/lib/api/resource';

import { authEnabled } from './registry';
import { sessionFromRequest, type SessionPayload } from './session';

/**
 * "Who is making this request", for route handlers.
 *
 * Two modes, because the app has to work both ways:
 *
 * - **Auth on.** The signed session cookie is the only answer. A caller cannot
 *   name themselves.
 * - **Auth off** (no identity provider configured). There is no session, so a
 *   caller may pass a uuid in `acting_user_id` and the UI passes the per-browser
 *   id from the user menu. That is not a security boundary and never was — it
 *   is the same "current user" the app has always had, kept working.
 *
 * `workspace_id` is likewise still supplied by the caller. Signing in says who
 * you are; it does not yet say which workspaces you may open. Membership is the
 * next piece of work, and it goes here.
 */

export type Actor = {
  /** `app_user.id` when signed in, or the caller-supplied id when auth is off. */
  user_id: string | null;
  session: SessionPayload | null;
};

const optionalUuid = z.uuid().nullable().catch(null);

export function actorFor(request: Request): Actor {
  const session = sessionFromRequest(request);
  if (session) {
    return { user_id: session.user_id, session };
  }

  if (authEnabled()) {
    return { user_id: null, session: null };
  }

  const claimed = new URL(request.url).searchParams.get('acting_user_id');
  return { user_id: optionalUuid.parse(claimed), session: null };
}

/**
 * The actor, or the 401 to return instead.
 *
 * Routes that write on someone's behalf — sending mail as their mailbox,
 * connecting one — use this. Generic CRUD deliberately does not: guarding it
 * without workspace membership would lock out the very setups this release does
 * not cover yet, and pretending otherwise would be worse than the honest gap.
 */
export function requireActor(
  request: Request,
): { actor: Actor; response: null } | { actor: null; response: Response } {
  const actor = actorFor(request);
  if (authEnabled() && !actor.session) {
    return { actor: null, response: fail(401, 'Sign in to continue') };
  }
  return { actor, response: null };
}
