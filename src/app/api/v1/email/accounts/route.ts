import { NextResponse } from 'next/server';
import { z } from 'zod';

import { toErrorResponse } from '@/lib/api/resource';
import { hasEncryptionKey } from '@/lib/crypto';
import { listAccounts, toPublicAccount } from '@/lib/email/accounts';
import { configuredEmailProviderId, emailProvider, emailProviderSummaries } from '@/lib/email/registry';

const querySchema = z.object({ workspace_id: z.uuid() });

/**
 * The mailboxes a workspace can send through, plus what the server is set up to
 * do — which provider is active, whether it is configured, and whether a
 * mailbox has to be connected at all.
 *
 * The settings screen needs both halves at once: with no accounts, the useful
 * thing to show is *why* (Gmail has no client id, no encryption key is set),
 * not an empty list. Secrets never leave `accounts.ts`.
 */
export async function GET(request: Request) {
  try {
    const { workspace_id } = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const activeId = configuredEmailProviderId();
    const active = emailProvider(activeId);
    const accounts = await listAccounts(workspace_id);

    return NextResponse.json({
      provider: {
        id: active.id,
        label: active.label,
        configured: active.isConfigured(),
        requires_connected_account: active.requiresConnectedAccount,
      },
      providers: emailProviderSummaries(),
      /** Without a key, a grant cannot be stored — worth saying before the button is pressed. */
      encryption_key_configured: hasEncryptionKey(),
      accounts: accounts.map(toPublicAccount),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
