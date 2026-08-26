/**
 * Browser client for the public chat API.
 *
 * Deliberately separate from `@/lib/api-client`: that one talks to the
 * workspace-scoped CRM API, this one talks to `/api/chat/<key>` as a customer,
 * carrying a visitor session token and knowing nothing about workspaces.
 */

export type PublicChannelConfig = {
  key: string;
  name: string;
  description: string | null;
  greeting: string | null;
  offline_message: string | null;
  is_enabled: boolean;
  intake_mode: 'deal' | 'case' | 'none';
  auth_mode: 'none' | 'optional' | 'required';
  requires_authentication: boolean;
  supports_authentication: boolean;
  collect_name: boolean;
  collect_email: boolean;
};

export type PublicSession = {
  token?: string;
  expires_at: string;
  is_authenticated: boolean;
  contact: { id: string; display_name: string | null; email: string | null; is_verified: boolean };
};

export type PublicConversation = {
  id: string;
  subject: string;
  status: 'open' | 'pending' | 'closed';
  created_at: string;
  last_message_at: string;
  last_message_preview: string | null;
  has_unread: boolean;
};

export type PublicMessage = {
  id: string;
  conversation_id: string;
  author_type: 'contact' | 'user' | 'system';
  author_name: string | null;
  body: string;
  created_at: string;
};

export class ChatApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail) && typeof detail[0]?.message === 'string'
          ? String(detail[0].message)
          : `Request failed with ${status}`,
    );
    this.name = 'ChatApiError';
  }
}

const base = (key: string) => `/api/chat/${encodeURIComponent(key)}`;

async function call<T>(
  path: string,
  { method = 'GET', body, token }: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ChatApiError(response.status, payload?.detail ?? response.statusText);
  }
  return payload as T;
}

export const chatApi = {
  config: (key: string) => call<PublicChannelConfig>(base(key)),

  startGuestSession: (key: string, input: { display_name?: string; email?: string }) =>
    call<PublicSession>(`${base(key)}/sessions`, { method: 'POST', body: input }),

  currentSession: (key: string, token: string) => call<PublicSession>(`${base(key)}/sessions`, { token }),

  requestCode: (key: string, email: string) =>
    call<{ sent: boolean; expires_at: string; debug_code?: string }>(`${base(key)}/auth/request-code`, {
      method: 'POST',
      body: { email },
    }),

  verifyCode: (key: string, input: { email: string; code: string; display_name?: string }) =>
    call<PublicSession>(`${base(key)}/auth/verify`, { method: 'POST', body: input }),

  listConversations: (key: string, token: string) =>
    call<PublicConversation[]>(`${base(key)}/conversations`, { token }),

  startConversation: (key: string, token: string, input: { subject?: string; message: string }) =>
    call<PublicConversation>(`${base(key)}/conversations`, { method: 'POST', body: input, token }),

  listMessages: (key: string, token: string, conversationId: string, after?: string | null) =>
    call<PublicMessage[]>(
      `${base(key)}/conversations/${conversationId}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`,
      { token },
    ),

  sendMessage: (key: string, token: string, conversationId: string, body: string) =>
    call<PublicMessage>(`${base(key)}/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: { body },
      token,
    }),

  closeConversation: (key: string, token: string, conversationId: string) =>
    call<PublicConversation>(`${base(key)}/conversations/${conversationId}`, {
      method: 'PATCH',
      body: { status: 'closed' },
      token,
    }),
};

/** Where a visitor's token lives — per channel, so two widgets on one page stay separate. */
export const tokenStorageKey = (channelKey: string) => `open-rm-chat:${channelKey}`;

export function readStoredToken(channelKey: string): string | null {
  try {
    return window.localStorage.getItem(tokenStorageKey(channelKey));
  } catch {
    return null;
  }
}

export function storeToken(channelKey: string, token: string | null) {
  try {
    if (token) window.localStorage.setItem(tokenStorageKey(channelKey), token);
    else window.localStorage.removeItem(tokenStorageKey(channelKey));
  } catch {
    // Private browsing or blocked storage: the session simply does not persist.
  }
}
