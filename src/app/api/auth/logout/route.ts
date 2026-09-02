import { NextResponse } from 'next/server';

import { authProvider } from '@/lib/auth/registry';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { safeReturnPath } from '@/lib/oauth';

import { AUTH_FLOW_COOKIE } from '../shared';

/**
 * Sign out.
 *
 * Clearing this app's cookie is the part that matters; the redirect on to the
 * provider's own logout endpoint is what stops the next sign-in sailing through
 * on the identity provider's session without a challenge. A provider with no
 * such endpoint (`logoutUrl` → null) just lands back on the app.
 *
 * Both verbs are accepted. POST is the correct one and is what the user menu
 * uses; GET exists because "go to /api/auth/logout" is the first thing anyone
 * tries, and a 405 there reads as sign-out being broken.
 */
async function signOut(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get('return_to'), '/');
  const landing = new URL(returnTo, url.origin).toString();

  const target = (() => {
    try {
      return authProvider().logoutUrl({ return_to: landing }) ?? landing;
    } catch {
      // A misconfigured provider must not be able to trap someone in a session.
      return landing;
    }
  })();

  const response = NextResponse.redirect(target);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(AUTH_FLOW_COOKIE);
  return response;
}

export const GET = signOut;
export const POST = signOut;
