import type { EmailAccount } from '@prisma/client';

import { decryptOptional, encryptOptional } from '@/lib/crypto';
import { prisma } from '@/lib/prisma';

import { emailProvider, oauthEmailProvider } from './registry';
import { EmailProviderError, isOAuthProvider, type MailboxCredentials, type OAuthGrant } from './types';

/**
 * Connected mailboxes: storing a grant, keeping its access token alive, and
 * handing credentials to a provider at send time.
 *
 * This is the only module that touches the token columns. Everything above it
 * works with `MailboxCredentials`, so no route, job, or component ever holds
 * ciphertext or decides when a token needs renewing.
 */

/**
 * Renew an access token this long before it actually expires.
 *
 * Sending is not instant and clocks are not identical; a token that expires
 * mid-flight fails the send outright, while renewing one a minute early costs
 * one extra request.
 */
const REFRESH_SKEW_MS = 60_000;

/** The account shape the API returns — everything except the secrets. */
export type PublicEmailAccount = {
  id: string;
  workspace_id: string;
  provider: string;
  provider_label: string;
  email: string;
  display_name: string | null;
  status: EmailAccount['status'];
  user_id: string | null;
  scope: string | null;
  last_error: string | null;
  connected_at: string;
};

export function toPublicAccount(account: EmailAccount): PublicEmailAccount {
  let providerLabel = account.provider;
  try {
    providerLabel = emailProvider(account.provider).label;
  } catch {
    // A row written by a provider that has since been removed from the registry
    // still lists, under its stored id, rather than breaking the settings page.
  }

  return {
    id: account.id,
    workspace_id: account.workspace_id,
    provider: account.provider,
    provider_label: providerLabel,
    email: account.email,
    display_name: account.display_name,
    status: account.status,
    user_id: account.user_id,
    scope: account.scope,
    last_error: account.last_error,
    connected_at: account.connected_at.toISOString(),
  };
}

/**
 * Record a completed grant.
 *
 * Keyed on workspace + provider + address, so re-connecting a mailbox — after a
 * password change, or to widen its scopes — updates the grant in place and
 * leaves the sent messages pointing at the same account.
 */
export async function saveGrant(params: {
  workspace_id: string;
  provider: string;
  grant: OAuthGrant;
  user_id?: string | null;
}): Promise<EmailAccount> {
  const { workspace_id, provider, grant, user_id } = params;

  const secrets = {
    access_token: encryptOptional(grant.access_token),
    refresh_token: encryptOptional(grant.refresh_token),
    access_token_expires_at: grant.expires_at,
    scope: grant.scope,
  };

  return prisma.emailAccount.upsert({
    where: { workspace_id_provider_email: { workspace_id, provider, email: grant.email } },
    create: {
      workspace_id,
      provider,
      email: grant.email,
      display_name: grant.display_name,
      provider_account_id: grant.account_id,
      user_id: user_id ?? null,
      status: 'connected',
      connected_at: new Date(),
      ...secrets,
    },
    update: {
      display_name: grant.display_name,
      provider_account_id: grant.account_id,
      // A re-connect by a different user hands the mailbox over; leaving it
      // owned by whoever connected it first would let them keep sending as it.
      user_id: user_id ?? null,
      status: 'connected',
      last_error: null,
      connected_at: new Date(),
      ...secrets,
    },
  });
}

/** Park an account that cannot send until someone grants access again. */
async function markNeedsReauth(accountId: string, message: string): Promise<void> {
  await prisma.emailAccount.update({
    where: { id: accountId },
    data: { status: 'needs_reauth', last_error: message },
  });
}

/**
 * Credentials for one send, with the access token renewed if it is close to
 * expiring.
 *
 * A provider that needs no connected account (the console provider, an SMTP
 * relay) has nothing to refresh, so its accounts pass straight through.
 */
export async function credentialsFor(account: EmailAccount): Promise<MailboxCredentials> {
  const provider = emailProvider(account.provider);
  const base = { email: account.email, display_name: account.display_name };

  if (!isOAuthProvider(provider)) {
    return base;
  }

  if (account.status === 'disconnected') {
    throw new EmailProviderError(`${account.email} is disconnected`, { needs_reauth: true });
  }

  const expiresAt = account.access_token_expires_at?.getTime() ?? 0;
  const stillFresh = expiresAt - REFRESH_SKEW_MS > Date.now();
  if (stillFresh && account.access_token) {
    return { ...base, access_token: decryptOptional(account.access_token) };
  }

  const refreshToken = decryptOptional(account.refresh_token);
  if (!refreshToken) {
    await markNeedsReauth(account.id, 'No refresh token is stored for this mailbox.');
    throw new EmailProviderError(`${account.email} needs to be connected again`, {
      needs_reauth: true,
    });
  }

  try {
    const grant = await provider.refresh(refreshToken);
    const updated = await prisma.emailAccount.update({
      where: { id: account.id },
      data: {
        access_token: encryptOptional(grant.access_token),
        access_token_expires_at: grant.expires_at,
        // Google returns no refresh token on a renewal; the stored one stays good.
        ...(grant.refresh_token ? { refresh_token: encryptOptional(grant.refresh_token) } : {}),
        ...(grant.scope ? { scope: grant.scope } : {}),
        status: 'connected',
        last_error: null,
      },
    });
    return { email: updated.email, display_name: updated.display_name, access_token: grant.access_token };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Refreshing the access token failed';
    if (error instanceof EmailProviderError && error.needsReauth) {
      await markNeedsReauth(account.id, message);
    } else {
      await prisma.emailAccount.update({
        where: { id: account.id },
        data: { last_error: message },
      });
    }
    throw error;
  }
}

/** The mailboxes a workspace can send through, newest grant first. */
export function listAccounts(workspaceId: string): Promise<EmailAccount[]> {
  return prisma.emailAccount.findMany({
    where: { workspace_id: workspaceId, status: { not: 'disconnected' } },
    orderBy: [{ connected_at: 'desc' }, { id: 'asc' }],
  });
}

export function findAccount(workspaceId: string, id: string): Promise<EmailAccount | null> {
  return prisma.emailAccount.findFirst({ where: { id, workspace_id: workspaceId } });
}

/**
 * The mailbox a send should use when the caller did not name one.
 *
 * Prefers a mailbox the sending user connected themselves — "send as me" is
 * what a CRM user means by email — and otherwise takes any healthy one in the
 * workspace, which is how a shared support address gets used.
 */
export async function defaultAccountFor(
  workspaceId: string,
  userId?: string | null,
): Promise<EmailAccount | null> {
  if (userId) {
    const own = await prisma.emailAccount.findFirst({
      where: { workspace_id: workspaceId, user_id: userId, status: 'connected' },
      orderBy: [{ connected_at: 'desc' }, { id: 'asc' }],
    });
    if (own) return own;
  }

  return prisma.emailAccount.findFirst({
    where: { workspace_id: workspaceId, status: 'connected' },
    orderBy: [{ connected_at: 'desc' }, { id: 'asc' }],
  });
}

/**
 * Disconnect a mailbox.
 *
 * The row is kept, with its secrets cleared, because `email_message` points at
 * it — deleting it would erase the sender from every message it ever sent.
 * Telling the provider is best effort: a grant this app has already forgotten
 * is no more usable if the revoke call fails.
 */
export async function disconnectAccount(account: EmailAccount): Promise<EmailAccount> {
  const provider = oauthEmailProvider(account.provider);
  const refreshToken = (() => {
    try {
      return decryptOptional(account.refresh_token);
    } catch {
      // A key rotation leaves ciphertext nobody can read. That is no reason to
      // refuse to disconnect the mailbox.
      return null;
    }
  })();

  if (provider?.revoke && refreshToken) {
    try {
      await provider.revoke(refreshToken);
    } catch (error) {
      console.error(`email: revoking the grant for ${account.email} failed`, error);
    }
  }

  return prisma.emailAccount.update({
    where: { id: account.id },
    data: {
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      access_token_expires_at: null,
      last_error: null,
    },
  });
}
