import { NextResponse } from 'next/server';

import { readCookie } from '@/lib/cookies';
import { saveGrant } from '@/lib/email/accounts';
import { configuredEmailProviderId, oauthEmailProvider } from '@/lib/email/registry';
import {
  cookiesAreSecure,
  decodePendingFlow,
  safeReturnPath,
  stateMatches,
} from '@/lib/oauth';

import { EMAIL_FLOW_COOKIE, EMAIL_SETTINGS_PATH } from '../shared';

/**
 * Finish connecting a mailbox.
 *
 * Same shape as the sign-in callback and for the same reasons: the pending flow
 * must exist, `state` must match it, and only then is the code exchanged. The
 * browser lands back on the settings page either way, with the outcome in the
 * query string — a consent screen is not a place to return JSON to.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = cookiesAreSecure(request);

  const flow = decodePendingFlow(readCookie(request, EMAIL_FLOW_COOKIE));
  const landing = safeReturnPath(flow?.return_to, EMAIL_SETTINGS_PATH);

  const back = (params: Record<string, string>) => {
    const target = new URL(landing, url.origin);
    for (const [key, value] of Object.entries(params)) target.searchParams.set(key, value);
    const response = NextResponse.redirect(target);
    response.cookies.set(EMAIL_FLOW_COOKIE, '', { path: '/', maxAge: 0, secure });
    return response;
  };

  const providerError = url.searchParams.get('error');
  if (providerError) {
    // `access_denied` is someone clicking Cancel, which is not a failure worth
    // shouting about.
    return back({
      connect_error:
        providerError === 'access_denied'
          ? 'Connecting the mailbox was cancelled.'
          : (url.searchParams.get('error_description') ?? providerError),
    });
  }

  if (!flow || !flow.workspace_id) {
    return back({ connect_error: 'That connection link has expired. Please try again.' });
  }
  if (!stateMatches(flow, url.searchParams.get('state'))) {
    return back({ connect_error: 'The connection could not be verified. Please try again.' });
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return back({ connect_error: 'The provider returned no authorization code.' });
  }

  const providerId = configuredEmailProviderId();
  const provider = oauthEmailProvider(providerId);
  if (!provider) {
    return back({ connect_error: 'This server no longer connects mailboxes over OAuth.' });
  }

  try {
    const grant = await provider.exchangeCode({
      code,
      redirect_uri: flow.redirect_uri,
      code_verifier: flow.code_verifier,
    });

    const account = await saveGrant({
      workspace_id: flow.workspace_id,
      provider: providerId,
      grant,
      // Set when a real user connected it; null when this deployment has no
      // sign-in, in which case the mailbox belongs to the workspace.
      user_id: flow.user_id ?? null,
    });

    return back({ connected: account.email });
  } catch (error) {
    console.error('email: connecting the mailbox failed', error);
    return back({
      connect_error: error instanceof Error ? error.message : 'Connecting the mailbox failed.',
    });
  }
}
