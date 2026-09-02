import { NextResponse } from 'next/server';

import { authProvider, configuredAuthProviderId } from '@/lib/auth/registry';
import {
  SESSION_COOKIE,
  encodeSession,
  sessionCookieOptions,
} from '@/lib/auth/session';
import { AuthProviderError } from '@/lib/auth/types';
import { readCookie } from '@/lib/cookies';
import { displayNameOf, upsertUserFromIdentity } from '@/lib/auth/users';
import {
  cookiesAreSecure,
  decodePendingFlow,
  safeReturnPath,
  stateMatches,
} from '@/lib/oauth';

import { AUTH_FLOW_COOKIE, SIGN_IN_PATH } from '../shared';

/**
 * Finish a sign-in.
 *
 * The order of checks is the security of the flow: the pending flow has to
 * exist, the `state` has to match it, and only then is the code exchanged —
 * after which the provider's ID token is verified against the issuer's keys and
 * the nonce this browser started with (`src/lib/auth/jwt.ts`).
 *
 * Failures land back on the sign-in page with a reason in the query string
 * rather than rendering an error document: someone who mistyped a password or
 * left a consent screen open too long needs the form again, not a stack trace.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = cookiesAreSecure(request);

  const signInWith = (reason: string) => {
    const target = new URL(SIGN_IN_PATH, url.origin);
    target.searchParams.set('error', reason);
    const response = NextResponse.redirect(target);
    response.cookies.delete(AUTH_FLOW_COOKIE);
    return response;
  };

  // The provider reports a refusal (a cancelled consent, a blocked user) here
  // rather than by failing the exchange.
  const providerError = url.searchParams.get('error');
  if (providerError) {
    return signInWith(url.searchParams.get('error_description') ?? providerError);
  }

  const flow = decodePendingFlow(readCookie(request, AUTH_FLOW_COOKIE));

  if (!flow) {
    return signInWith('That sign-in link has expired. Please try again.');
  }
  if (!stateMatches(flow, url.searchParams.get('state'))) {
    return signInWith('The sign-in could not be verified. Please try again.');
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return signInWith('The identity provider returned no authorization code.');
  }

  try {
    const providerId = configuredAuthProviderId();
    const identity = await authProvider(providerId).exchangeCode({
      code,
      redirect_uri: flow.redirect_uri,
      code_verifier: flow.code_verifier,
      nonce: flow.nonce ?? '',
    });

    const user = await upsertUserFromIdentity(providerId, identity);

    const response = NextResponse.redirect(new URL(safeReturnPath(flow.return_to, '/'), url.origin));
    response.cookies.set(
      SESSION_COOKIE,
      encodeSession({
        user_id: user.id,
        provider: providerId,
        subject: user.external_id,
        name: displayNameOf(user),
        email: user.email,
        picture_url: user.picture_url,
      }),
      sessionCookieOptions(secure),
    );
    response.cookies.delete(AUTH_FLOW_COOKIE);
    return response;
  } catch (error) {
    console.error('auth: completing the sign-in failed', error);
    return signInWith(
      error instanceof AuthProviderError ? error.message : 'Signing in failed. Please try again.',
    );
  }
}
