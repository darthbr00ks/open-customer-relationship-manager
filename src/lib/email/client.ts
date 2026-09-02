/**
 * The browser's view of the email API.
 *
 * `src/lib/api-client.ts` covers the generic `/api/v1/<resource>` shape; email
 * is not one of those — it has a settings payload, a connect redirect, and a
 * send that reports a per-message outcome — so its calls live here rather than
 * being bent into the resource client.
 *
 * Nothing in this file may import from `./accounts`, `./send`, or a provider:
 * those are server modules that read secrets and touch the database.
 */

import { ApiError } from '@/lib/api-client';

export type EmailAccountSummary = {
  id: string;
  provider: string;
  provider_label: string;
  email: string;
  display_name: string | null;
  status: 'connected' | 'needs_reauth' | 'disconnected';
  last_error: string | null;
  connected_at: string;
};

export type EmailSettings = {
  provider: {
    id: string;
    label: string;
    configured: boolean;
    requires_connected_account: boolean;
  };
  providers: {
    id: string;
    label: string;
    configured: boolean;
    active: boolean;
    requires_connected_account: boolean;
  }[];
  encryption_key_configured: boolean;
  accounts: EmailAccountSummary[];
};

/** One sent (or failed) message, as the API returns it. */
export type SentEmail = {
  id: string;
  status: 'queued' | 'sent' | 'failed';
  subject: string;
  to_addresses: string;
  sent_at: string | null;
  /** The provider's reason when `status` is `failed`. */
  error: string | null;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, body?.detail ?? response.statusText);
  }
  return body as T;
}

export const fetchEmailSettings = (workspaceId: string) =>
  request<EmailSettings>(`/api/v1/email/accounts?workspace_id=${encodeURIComponent(workspaceId)}`);

export const disconnectEmailAccount = (workspaceId: string, accountId: string) =>
  request<EmailAccountSummary>(
    `/api/v1/email/accounts/${accountId}?workspace_id=${encodeURIComponent(workspaceId)}`,
    { method: 'DELETE' },
  );

export type SendEmailRequest = {
  workspace_id: string;
  account_id?: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body_text: string;
  parent_type?: string;
  parent_id?: string;
  created_by_user_id?: string;
};

/**
 * Send one message.
 *
 * A provider's refusal comes back as a `failed` message with `error` set rather
 * than as a thrown `ApiError` — the message exists either way, and the composer
 * shows the reason instead of a generic failure.
 */
export const sendEmailMessage = (body: SendEmailRequest) =>
  request<SentEmail & { error: string | null }>('/api/v1/email/messages', {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const fetchEmailsFor = (workspaceId: string, parentType: string, parentId: string) =>
  request<SentEmail[]>(
    `/api/v1/email/messages?workspace_id=${encodeURIComponent(workspaceId)}` +
      `&parent_type=${encodeURIComponent(parentType)}&parent_id=${encodeURIComponent(parentId)}`,
  );
