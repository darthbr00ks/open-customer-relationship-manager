import { NextResponse } from 'next/server';

import { authProvider } from '@/lib/auth/registry';
import { AuthProviderError } from '@/lib/auth/types';
import {
  callbackUrl,
  codeChallengeFor,
  cookiesAreSecure,
  encodePendingFlow,
  flowCookieOptions,
  newCodeVerifier,
  newNonce,
  newState,
  safeReturnPath,
} from '@/lib/oauth';

import { AUTH_FLOW_COOKIE, AUTH_CALLBACK_PATH } from '../shared';

/**
 * Start a sign-in.
 *
 * A GET rather than a POST because the browser arrives here by following a
 * link — from the sign-in page, or from the route guard's redirect — and
 * nothing is changed on this side beyond a cookie holding the flow it is about
 * to complete.
 */
export async function GET(request: Request) {
  try {
    const provider = authProvider();
    const url = new URL(request.url);

    const state = newState();
    const codeVerifier = newCodeVerifier();
    const nonce = newNonce();
    const redirectUri = callbackUrl(request, AUTH_CALLBACK_PATH);

    const authorizeUrl = provider.authorizationUrl({
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallengeFor(codeVerifier),
      nonce,
      login_hint: url.searchParams.get('login_hint'),
    });

    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set(
      AUTH_FLOW_COOKIE,
      encodePendingFlow({
        state,
        code_verifier: codeVerifier,
        nonce,
        redirect_uri: redirectUri,
        return_to: safeReturnPath(url.searchParams.get('return_to'), '/'),
      }),
      flowCookieOptions(cookiesAreSecure(request)),
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sign-in could not be started';
    const status = error instanceof AuthProviderError ? error.status : 500;
    return NextResponse.json({ detail: message }, { status });
  }
}
