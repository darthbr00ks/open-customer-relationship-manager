import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { DELETE as disconnectAccount, GET as getAccount } from '@/app/api/v1/email/accounts/[id]/route';
import { GET as listAccounts } from '@/app/api/v1/email/accounts/route';
import { GET as listMessages, POST as sendMessage } from '@/app/api/v1/email/messages/route';
import { decryptSecret, encryptSecret } from '@/lib/crypto';
import {
  buildMimeMessage,
  formatAddress,
  isValidEmailAddress,
  parseAddressList,
} from '@/lib/email/mime';
import { GmailProvider } from '@/lib/email/providers/gmail';
import { configuredEmailProviderId, emailProvider } from '@/lib/email/registry';
import { InvalidEmailError, sendEmail } from '@/lib/email/send';
import { EmailProviderError } from '@/lib/email/types';
import { prisma } from '@/lib/prisma';

import { BASE, jsonRequest, resetDatabase, routeContext, uuid } from './helpers';

const workspace = uuid();

beforeAll(() => {
  // The encryption key is what lets a grant be stored at all; a fixed one keeps
  // the suite independent of whatever the developer has in their environment.
  process.env.SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
});

beforeEach(resetDatabase);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

/**
 * A mailbox on the console provider: it needs no tokens and no network, so the
 * whole send path can be exercised without a Google project. That it works at
 * all is the point of `EmailProvider` — nothing above the interface knows or
 * cares which implementation is behind it.
 */
const makeAccount = (overrides: Record<string, unknown> = {}) =>
  prisma.emailAccount.create({
    data: {
      workspace_id: workspace,
      provider: 'console',
      email: 'sales@openrm.test',
      display_name: 'Open RM Sales',
      ...overrides,
    },
  });

/* -------------------------------------------------------------------------- */
/* Secrets at rest                                                             */
/* -------------------------------------------------------------------------- */

describe('secret encryption', () => {
  it('round-trips a value', () => {
    const token = '1//0abcdef-refresh-token';
    expect(decryptSecret(encryptSecret(token))).toBe(token);
  });

  it('produces a different ciphertext each time', () => {
    // A fresh IV per call, so two identical refresh tokens are not identifiable
    // as identical from the stored rows alone.
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('refuses a tampered ciphertext', () => {
    const encrypted = encryptSecret('secret');
    const [version, iv, tag, body] = encrypted.split('.');
    const flipped = Buffer.from(body, 'base64url');
    flipped[0] ^= 0xff;
    expect(() => decryptSecret([version, iv, tag, flipped.toString('base64url')].join('.'))).toThrow();
  });

  it('refuses a key of the wrong length', () => {
    vi.stubEnv('SECRET_ENCRYPTION_KEY', Buffer.alloc(16, 1).toString('base64'));
    expect(() => encryptSecret('secret')).toThrow(/32 bytes/);
  });
});

/* -------------------------------------------------------------------------- */
/* MIME                                                                        */
/* -------------------------------------------------------------------------- */

describe('buildMimeMessage', () => {
  const base = {
    from: { email: 'sales@openrm.test', name: 'Open RM Sales' },
    to: [{ email: 'ada@example.test', name: 'Ada Lovelace' }],
    subject: 'Following up',
    text: 'Hello there.',
  };

  it('writes the headers a mail server expects', () => {
    const { raw, message_id } = buildMimeMessage(base);

    expect(raw).toContain('From: "Open RM Sales" <sales@openrm.test>');
    expect(raw).toContain('To: "Ada Lovelace" <ada@example.test>');
    expect(raw).toContain('Subject: Following up');
    expect(raw).toContain(`Message-ID: ${message_id}`);
    expect(raw).toContain('Content-Transfer-Encoding: base64');
    // Headers are separated from the body by a blank line, CRLF throughout.
    expect(raw).toContain('\r\n\r\n');
  });

  it('base64-encodes the body', () => {
    const { raw } = buildMimeMessage({ ...base, text: 'Hello there.' });
    const body = raw.split('\r\n\r\n').slice(1).join('\r\n\r\n');
    expect(Buffer.from(body, 'base64').toString('utf8')).toBe('Hello there.');
  });

  it('encodes a non-ASCII display name and subject as RFC 2047 words', () => {
    const { raw } = buildMimeMessage({
      ...base,
      to: [{ email: 'jose@example.test', name: 'José Ramírez' }],
      subject: 'Café ☕',
    });

    expect(raw).toContain('=?UTF-8?B?');
    // Nothing outside printable ASCII may reach a header.
    const headers = raw.split('\r\n\r\n')[0];
    expect(/^[\x20-\x7e\r\n]*$/.test(headers)).toBe(true);
  });

  it('sends text and HTML as multipart/alternative, text first', () => {
    const { raw } = buildMimeMessage({ ...base, html: '<p>Hello there.</p>' });

    expect(raw).toContain('Content-Type: multipart/alternative; boundary="');
    expect(raw.indexOf('text/plain')).toBeLessThan(raw.indexOf('text/html'));
  });

  it('never writes a Bcc header', () => {
    // Writing it would show every blind copy to every recipient.
    const { raw } = buildMimeMessage({ ...base, bcc: [{ email: 'boss@openrm.test' }] });
    expect(raw).not.toContain('boss@openrm.test');
  });

  it('threads a reply with both In-Reply-To and References', () => {
    const { raw } = buildMimeMessage({ ...base, in_reply_to: '<parent@example.test>' });
    expect(raw).toContain('In-Reply-To: <parent@example.test>');
    expect(raw).toContain('References: <parent@example.test>');
  });

  it('refuses a value that would inject a header', () => {
    expect(() => buildMimeMessage({ ...base, subject: 'Hi\r\nBcc: victim@example.test' })).toThrow(
      /line break/,
    );
    expect(() =>
      buildMimeMessage({ ...base, to: [{ email: 'a@b.test', name: 'X\r\nCc: c@d.test' }] }),
    ).toThrow(/line break/);
  });

  it('needs a recipient', () => {
    expect(() => buildMimeMessage({ ...base, to: [] })).toThrow(/recipient/);
  });
});

describe('address handling', () => {
  it('parses a mixed list', () => {
    expect(parseAddressList('Ada <ada@example.test>, bob@example.test; "Eve" <eve@example.test>')).toEqual([
      { email: 'ada@example.test', name: 'Ada' },
      { email: 'bob@example.test', name: null },
      { email: 'eve@example.test', name: 'Eve' },
    ]);
  });

  it('accepts plausible addresses and rejects the rest', () => {
    expect(isValidEmailAddress('ada@example.test')).toBe(true);
    expect(isValidEmailAddress('ada+crm@mail.example.co.uk')).toBe(true);

    expect(isValidEmailAddress('ada')).toBe(false);
    expect(isValidEmailAddress('ada@localhost')).toBe(false);
    expect(isValidEmailAddress('ada@@example.test')).toBe(false);
    expect(isValidEmailAddress('ada example@test.com')).toBe(false);
    expect(isValidEmailAddress('a@b.test\r\nBcc: x@y.test')).toBe(false);
  });

  it('quotes a display name that contains a quote', () => {
    expect(formatAddress({ email: 'a@b.test', name: 'Ada "Countess" L' })).toBe(
      '"Ada \\"Countess\\" L" <a@b.test>',
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Provider registry                                                           */
/* -------------------------------------------------------------------------- */

describe('provider registry', () => {
  it('honours EMAIL_PROVIDER', () => {
    vi.stubEnv('EMAIL_PROVIDER', 'console');
    expect(configuredEmailProviderId()).toBe('console');
    expect(emailProvider().id).toBe('console');
  });

  it('picks Gmail once it has credentials', () => {
    vi.stubEnv('EMAIL_PROVIDER', '');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret');
    expect(configuredEmailProviderId()).toBe('gmail');
  });

  it('falls back to the console provider outside production', () => {
    vi.stubEnv('EMAIL_PROVIDER', '');
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(configuredEmailProviderId()).toBe('console');
  });

  it('rejects a provider it does not know', () => {
    expect(() => emailProvider('carrier-pigeon')).toThrow(/Unknown email provider/);
  });
});

/* -------------------------------------------------------------------------- */
/* Gmail                                                                       */
/* -------------------------------------------------------------------------- */

describe('GmailProvider', () => {
  const provider = new GmailProvider();

  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret');
  });

  it('asks for offline access, forced consent, and PKCE', () => {
    const url = new URL(
      provider.authorizationUrl({
        redirect_uri: 'https://crm.test/api/v1/email/callback',
        state: 'state-value',
        code_challenge: 'challenge-value',
        login_hint: 'me@gmail.com',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    // Without offline access there is no refresh token, and the grant would die
    // with the browser session.
    expect(url.searchParams.get('access_type')).toBe('offline');
    // Without forced consent, a repeat connect returns no refresh token at all.
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('state')).toBe('state-value');
    expect(url.searchParams.get('login_hint')).toBe('me@gmail.com');
    expect(url.searchParams.get('scope')).toContain('gmail.send');
  });

  it('refuses to build a URL with no credentials', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', '');
    expect(() =>
      provider.authorizationUrl({ redirect_uri: 'https://crm.test/cb', state: 's', code_challenge: 'c' }),
    ).toThrow(/not configured/);
  });

  it('sends the raw message and returns the provider ids', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 'msg-1', threadId: 'thread-1' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await provider.send(
      {
        from: { email: 'ignored@example.test' },
        to: [{ email: 'ada@example.test' }],
        subject: 'Hi',
        text: 'Hello',
      },
      { email: 'me@gmail.test', display_name: 'Me', access_token: 'token-value' },
    );

    expect(result).toEqual({ provider_message_id: 'msg-1', provider_thread_id: 'thread-1' });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer token-value');

    // Gmail sends as the granted account whatever the caller passed, so the
    // header is rewritten rather than trusted.
    const raw = Buffer.from(JSON.parse(init.body as string).raw, 'base64url').toString('utf8');
    expect(raw).toContain('From: "Me" <me@gmail.test>');
    expect(raw).not.toContain('ignored@example.test');
  });

  it('treats a 401 from Gmail as a dead grant', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Invalid Credentials' } }), { status: 401 })),
    );

    await expect(
      provider.send(
        { from: { email: 'a@b.test' }, to: [{ email: 'c@d.test' }], subject: 'x', text: 'y' },
        { email: 'me@gmail.test', access_token: 'stale' },
      ),
    ).rejects.toMatchObject({ name: 'EmailProviderError', needsReauth: true });
  });

  it('treats a 429 as worth retrying but not worth re-consenting', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Rate limited' } }), { status: 429 })),
    );

    const caught = await provider
      .send(
        { from: { email: 'a@b.test' }, to: [{ email: 'c@d.test' }], subject: 'x', text: 'y' },
        { email: 'me@gmail.test', access_token: 'fine' },
      )
      .catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(EmailProviderError);
    expect((caught as EmailProviderError).retryable).toBe(true);
    expect((caught as EmailProviderError).needsReauth).toBe(false);
  });

  it('reads invalid_grant on refresh as needing a new consent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 })),
    );

    await expect(provider.refresh('dead-token')).rejects.toMatchObject({ needsReauth: true });
  });
});

/* -------------------------------------------------------------------------- */
/* Sending                                                                     */
/* -------------------------------------------------------------------------- */

describe('sendEmail', () => {
  it('records the message, sends it, and files it on the record timeline', async () => {
    const account = await makeAccount();
    const personId = uuid();

    const { message, error } = await sendEmail({
      workspace_id: workspace,
      account,
      to: 'Ada <ada@example.test>, bob@example.test',
      cc: 'cc@example.test',
      subject: 'Following up',
      body_text: 'Hello there.',
      parent_type: 'person',
      parent_id: personId,
    });

    expect(error).toBeNull();
    expect(message.status).toBe('sent');
    expect(message.sent_at).not.toBeNull();
    expect(message.to_addresses).toBe('ada@example.test, bob@example.test');
    expect(message.cc_addresses).toBe('cc@example.test');

    const notes = await prisma.note.findMany({
      where: { workspace_id: workspace, parent_type: 'person', parent_id: personId },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].kind).toBe('system');
    expect(notes[0].body).toContain('Following up');
  });

  it('keeps a failed message instead of losing it', async () => {
    const account = await makeAccount();
    vi.stubEnv('EMAIL_PROVIDER', 'console');

    // Force a provider-level failure by pointing the row at a provider that is
    // no longer registered — the same shape as a mailbox whose grant is gone.
    const orphaned = await prisma.emailAccount.update({
      where: { id: account.id },
      data: { provider: 'retired-provider' },
    });

    const { message, error } = await sendEmail({
      workspace_id: workspace,
      account: orphaned,
      to: 'ada@example.test',
      subject: 'Following up',
      body_text: 'Hello there.',
    });

    expect(error).toMatch(/Unknown email provider/);
    expect(message.status).toBe('failed');
    expect(message.error).toBe(error);
    expect(await prisma.emailMessage.count({ where: { workspace_id: workspace } })).toBe(1);
  });

  it('rejects a malformed address before writing anything', async () => {
    const account = await makeAccount();

    await expect(
      sendEmail({
        workspace_id: workspace,
        account,
        to: 'not-an-address',
        subject: 'Hi',
        body_text: 'Hello',
      }),
    ).rejects.toBeInstanceOf(InvalidEmailError);

    expect(await prisma.emailMessage.count()).toBe(0);
  });

  it('refuses a mailbox from another workspace', async () => {
    const account = await makeAccount({ workspace_id: uuid(), email: 'other@openrm.test' });

    await expect(
      sendEmail({
        workspace_id: workspace,
        account,
        to: 'ada@example.test',
        subject: 'Hi',
        body_text: 'Hello',
      }),
    ).rejects.toThrow(/another workspace/);
  });

  it('needs a subject and a body', async () => {
    const account = await makeAccount();
    const base = { workspace_id: workspace, account, to: 'ada@example.test' };

    await expect(sendEmail({ ...base, subject: '  ', body_text: 'Hello' })).rejects.toThrow(/subject/);
    await expect(sendEmail({ ...base, subject: 'Hi', body_text: '  ' })).rejects.toThrow(/body/);
  });
});

/* -------------------------------------------------------------------------- */
/* API                                                                         */
/* -------------------------------------------------------------------------- */

describe('email API', () => {
  it('reports the provider and the connected mailboxes', async () => {
    vi.stubEnv('EMAIL_PROVIDER', 'console');
    await makeAccount();

    const response = await listAccounts(
      jsonRequest(`${BASE}/api/v1/email/accounts?workspace_id=${workspace}`, 'GET'),
    );
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.provider.id).toBe('console');
    expect(body.encryption_key_configured).toBe(true);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0].email).toBe('sales@openrm.test');
    // Secrets must never leave `accounts.ts`.
    expect(JSON.stringify(body)).not.toContain('access_token');
  });

  it('sends through the workspace default when no mailbox is named', async () => {
    await makeAccount();

    const response = await sendMessage(
      jsonRequest(`${BASE}/api/v1/email/messages`, 'POST', {
        workspace_id: workspace,
        to: 'ada@example.test',
        subject: 'Hello',
        body_text: 'Hi there.',
      }),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.status).toBe('sent');
    expect(body.error).toBeNull();
  });

  it('explains itself when no mailbox is connected', async () => {
    const response = await sendMessage(
      jsonRequest(`${BASE}/api/v1/email/messages`, 'POST', {
        workspace_id: workspace,
        to: 'ada@example.test',
        subject: 'Hello',
        body_text: 'Hi there.',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ detail: expect.stringContaining('No mailbox') });
  });

  it('will not send through a mailbox that needs reconnecting', async () => {
    const account = await makeAccount({ status: 'needs_reauth' });

    const response = await sendMessage(
      jsonRequest(`${BASE}/api/v1/email/messages`, 'POST', {
        workspace_id: workspace,
        account_id: account.id,
        to: 'ada@example.test',
        subject: 'Hello',
        body_text: 'Hi there.',
      }),
    );

    expect(response.status).toBe(409);
  });

  it('rejects an invalid address with 422', async () => {
    await makeAccount();

    const response = await sendMessage(
      jsonRequest(`${BASE}/api/v1/email/messages`, 'POST', {
        workspace_id: workspace,
        to: 'ada@example.test, nonsense',
        subject: 'Hello',
        body_text: 'Hi there.',
      }),
    );

    expect(response.status).toBe(422);
  });

  it('lists sent mail for one record', async () => {
    const account = await makeAccount();
    const dealId = uuid();

    await sendEmail({
      workspace_id: workspace,
      account,
      to: 'ada@example.test',
      subject: 'About the deal',
      body_text: 'Hello',
      parent_type: 'deal',
      parent_id: dealId,
    });
    await sendEmail({
      workspace_id: workspace,
      account,
      to: 'bob@example.test',
      subject: 'Unrelated',
      body_text: 'Hello',
    });

    const response = await listMessages(
      jsonRequest(
        `${BASE}/api/v1/email/messages?workspace_id=${workspace}&parent_type=deal&parent_id=${dealId}`,
        'GET',
      ),
    );

    const rows = await response.json();
    expect(rows).toHaveLength(1);
    expect(rows[0].subject).toBe('About the deal');
  });

  it('disconnects a mailbox without deleting what it sent', async () => {
    const account = await makeAccount({
      access_token: encryptSecret('access'),
      refresh_token: encryptSecret('refresh'),
    });
    await sendEmail({
      workspace_id: workspace,
      account,
      to: 'ada@example.test',
      subject: 'Hi',
      body_text: 'Hello',
    });

    const response = await disconnectAccount(
      jsonRequest(`${BASE}/api/v1/email/accounts/${account.id}?workspace_id=${workspace}`, 'DELETE'),
      routeContext(account.id),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('disconnected');

    const stored = await prisma.emailAccount.findUniqueOrThrow({ where: { id: account.id } });
    expect(stored.access_token).toBeNull();
    expect(stored.refresh_token).toBeNull();
    // The message keeps its sender.
    expect(await prisma.emailMessage.count({ where: { account_id: account.id } })).toBe(1);
  });

  it('does not reach across workspaces', async () => {
    const account = await makeAccount();

    const response = await getAccount(
      jsonRequest(`${BASE}/api/v1/email/accounts/${account.id}?workspace_id=${uuid()}`, 'GET'),
      routeContext(account.id),
    );
    expect(response.status).toBe(404);
  });
});
