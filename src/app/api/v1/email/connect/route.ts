import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireActor } from '@/lib/auth/current-user';
import { fail, toErrorResponse } from '@/lib/api/resource';
import { hasEncryptionKey } from '@/lib/crypto';
import { emailProvider, oauthEmailProvider } from '@/lib/email/registry';
import {
  callbackUrl,
  codeChallengeFor,
  cookiesAreSecure,
  encodePendingFlow,
  flowCookieOptions,
  newCodeVerifier,
  newState,
  safeReturnPath,
} from '@/lib/oauth';

import { EMAIL_CALLBACK_PATH, EMAIL_FLOW_COOKIE, EMAIL_SETTINGS_PATH } from '../shared';

const querySchema = z.object({
  workspace_id: z.uuid(),
  /** Pre-selects the account on the provider's chooser. */
  login_hint: z.string().optional(),
  return_to: z.string().optional(),
});

/**
 * Start connecting a mailbox.
 *
 * A GET because the browser follows a link here — the whole point is to leave
 * for the provider's consent screen — and the only thing written on this side
 * is the flow cookie the callback consumes.
 *
 * The encryption key is checked *before* the user is sent to Google rather than
 * after they come back: granting consent and then being told the tokens cannot
 * be stored wastes the one round trip that actually asks something of them.
 */
export async function GET(request: Request) {
  try {
    const { actor, response: denied } = requireActor(request);
    if (denied) return denied;

    const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));

    const provider = oauthEmailProvider();
    if (!provider) {
      return fail(
        400,
        `${emailProvider().label} does not connect mailboxes — it sends with credentials from the environment.`,
      );
    }
    if (!provider.isConfigured()) {
      return fail(400, `${provider.label} is not configured on this server.`);
    }
    if (!hasEncryptionKey()) {
      return fail(
        500,
        'SECRET_ENCRYPTION_KEY is not set, so a mailbox grant cannot be stored safely.',
      );
    }

    const state = newState();
    const codeVerifier = newCodeVerifier();
    const redirectUri = callbackUrl(request, EMAIL_CALLBACK_PATH);

    const response = NextResponse.redirect(
      provider.authorizationUrl({
        redirect_uri: redirectUri,
        state,
        code_challenge: codeChallengeFor(codeVerifier),
        login_hint: query.login_hint ?? null,
      }),
    );

    response.cookies.set(
      EMAIL_FLOW_COOKIE,
      encodePendingFlow({
        state,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri,
        return_to: safeReturnPath(query.return_to, EMAIL_SETTINGS_PATH),
        workspace_id: query.workspace_id,
        // Only a signed-in user owns a mailbox. With auth off there is no
        // `app_user` row to point `email_account.user_id` at, so the mailbox is
        // connected to the workspace and anyone in it may send through it.
        user_id: actor.session?.user_id ?? null,
      }),
      flowCookieOptions(cookiesAreSecure(request)),
    );
    return response;
  } catch (error) {
    return toErrorResponse(error);
  }
}
