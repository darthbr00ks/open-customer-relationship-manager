'use client';

import { ArrowLeft, MessagesSquare, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { MessageBubble } from '@/components/chat/message-bubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  chatApi,
  ChatApiError,
  readStoredToken,
  storeToken,
  type PublicChannelConfig,
  type PublicConversation,
  type PublicMessage,
  type PublicSession,
} from '@/lib/chat/widget-client';
import { formatRelativeTime } from '@/lib/format';

/** How often an open thread checks for a reply. */
const POLL_MS = 5000;

type Screen = { name: 'list' } | { name: 'new' } | { name: 'thread'; conversation: PublicConversation };

/**
 * The customer's side of a chat channel.
 *
 * One component covers every configuration, because what a channel requires is
 * data, not a different build: a channel with `auth_mode: 'required'` opens on
 * the verification step, one without it opens on whatever it collects, and a
 * disabled channel shows its offline message and nothing else.
 */
export function ChatWidget({ channelKey }: { channelKey: string }) {
  const [config, setConfig] = useState<PublicChannelConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<Screen>({ name: 'list' });
  const [conversations, setConversations] = useState<PublicConversation[]>([]);
  /** Bumped whenever something should re-read the visitor's thread list. */
  const [conversationsVersion, setConversationsVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    chatApi
      .config(channelKey)
      .then(async (loaded) => {
        if (cancelled) return;
        setConfig(loaded);

        const stored = readStoredToken(channelKey);
        if (!stored) return;
        try {
          const current = await chatApi.currentSession(channelKey, stored);
          if (cancelled) return;
          setSession(current);
          setToken(stored);
        } catch {
          // Expired or revoked: start over rather than showing a broken widget.
          storeToken(channelKey, null);
        }
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof ChatApiError ? error.message : 'Chat is unavailable right now.'),
      );
    return () => {
      cancelled = true;
    };
  }, [channelKey]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    chatApi
      .listConversations(channelKey, token)
      .then((rows) => {
        if (!cancelled) setConversations(rows);
      })
      .catch(() => {
        // A dropped read is not worth interrupting the visitor for.
      });
    return () => {
      cancelled = true;
    };
  }, [channelKey, token, conversationsVersion]);

  const onSignedIn = (result: PublicSession) => {
    if (result.token) {
      storeToken(channelKey, result.token);
      setToken(result.token);
    }
    setSession(result);
  };

  if (loadError) return <Shell title="Chat"><Notice>{loadError}</Notice></Shell>;
  if (!config) return <Shell title="Chat"><Notice>Loading…</Notice></Shell>;

  if (!config.is_enabled) {
    return (
      <Shell title={config.name}>
        <Notice>{config.offline_message ?? 'This chat is not accepting messages right now.'}</Notice>
      </Shell>
    );
  }

  if (!session || !token) {
    return (
      <Shell title={config.name} subtitle={config.greeting}>
        <SignIn config={config} channelKey={channelKey} onSignedIn={onSignedIn} />
      </Shell>
    );
  }

  if (screen.name === 'thread') {
    return (
      <Shell
        title={screen.conversation.subject}
        onBack={() => {
          setScreen({ name: 'list' });
          setConversationsVersion((version) => version + 1);
        }}
      >
        <Thread
          channelKey={channelKey}
          token={token}
          conversation={screen.conversation}
        />
      </Shell>
    );
  }

  if (screen.name === 'new') {
    return (
      <Shell title={`New message`} onBack={() => setScreen({ name: 'list' })}>
        <NewConversation
          channelKey={channelKey}
          token={token}
          onStarted={(conversation) => {
            setConversations((current) => [conversation, ...current]);
            setScreen({ name: 'thread', conversation });
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell title={config.name} subtitle={config.greeting}>
      <div className="flex flex-col gap-3">
        <Button onClick={() => setScreen({ name: 'new' })}>
          <MessagesSquare /> Start a conversation
        </Button>

        {conversations.length === 0 ? (
          <Notice>No conversations yet.</Notice>
        ) : (
          <div className="divide-y overflow-hidden rounded-md border">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                className="hover:bg-accent block w-full px-3 py-2.5 text-left"
                onClick={() => setScreen({ name: 'thread', conversation })}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{conversation.subject}</span>
                  {conversation.has_unread ? (
                    <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="New reply" />
                  ) : null}
                </div>
                {conversation.last_message_preview ? (
                  <p className="text-muted-foreground truncate text-xs">{conversation.last_message_preview}</p>
                ) : null}
                <p className="text-muted-foreground mt-0.5 text-xs">
                  {conversation.status === 'closed' ? 'Closed · ' : ''}
                  {formatRelativeTime(conversation.last_message_at)}
                </p>
              </button>
            ))}
          </div>
        )}

        <p className="text-muted-foreground text-center text-xs">
          Signed in as {session.contact.display_name || session.contact.email || 'a guest'}
          {session.contact.is_verified ? ' (verified)' : ''}.
        </p>
      </div>
    </Shell>
  );
}

/* -------------------------------------------------------------------------- */
/* Screens                                                                     */
/* -------------------------------------------------------------------------- */

/** Whichever way in this channel is configured for: a code, or just a name. */
function SignIn({
  config,
  channelKey,
  onSignedIn,
}: {
  config: PublicChannelConfig;
  channelKey: string;
  onSignedIn: (session: PublicSession) => void;
}) {
  const [verifying, setVerifying] = useState(config.requires_authentication);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof ChatApiError ? cause.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (verifying) {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (!codeSent) {
              const result = await chatApi.requestCode(channelKey, email);
              setCodeSent(true);
              setHint(
                result.debug_code
                  ? `Development mode: your code is ${result.debug_code}`
                  : 'We sent you a six-digit code.',
              );
              return;
            }
            onSignedIn(await chatApi.verifyCode(channelKey, { email, code, display_name: name || undefined }));
          });
        }}
      >
        <p className="text-muted-foreground text-sm">
          {config.requires_authentication
            ? 'Verify your email address to start chatting.'
            : 'Verify your email so we can recognize you next time.'}
        </p>

        <Field id="chat-email" label="Email">
          <Input
            id="chat-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={codeSent}
          />
        </Field>

        {codeSent ? (
          <>
            <Field id="chat-code" label="Verification code">
              <Input
                id="chat-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            {config.collect_name ? (
              <Field id="chat-name" label="Your name">
                <Input id="chat-name" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
            ) : null}
          </>
        ) : null}

        {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        <Button type="submit" disabled={busy}>
          {codeSent ? 'Verify and continue' : 'Send me a code'}
        </Button>

        {codeSent ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setCodeSent(false); setCode(''); setHint(null); }}>
            Use a different address
          </Button>
        ) : null}
        {!config.requires_authentication ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setVerifying(false)}>
            Continue as a guest instead
          </Button>
        ) : null}
      </form>
    );
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void run(async () => {
          onSignedIn(
            await chatApi.startGuestSession(channelKey, {
              display_name: name || undefined,
              email: email || undefined,
            }),
          );
        });
      }}
    >
      {config.collect_name ? (
        <Field id="chat-name" label="Your name">
          <Input id="chat-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      ) : null}
      {config.collect_email ? (
        <Field id="chat-email" label="Email">
          <Input id="chat-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Button type="submit" disabled={busy}>Start chatting</Button>

      {config.supports_authentication ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setVerifying(true)}>
          Verify my email instead
        </Button>
      ) : null}
    </form>
  );
}

function NewConversation({
  channelKey,
  token,
  onStarted,
}: {
  channelKey: string;
  token: string;
  onStarted: (conversation: PublicConversation) => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        chatApi
          .startConversation(channelKey, token, { subject: subject || undefined, message })
          .then(onStarted)
          .catch((cause: unknown) =>
            setError(cause instanceof ChatApiError ? cause.message : 'Could not send that message.'),
          )
          .finally(() => setBusy(false));
      }}
    >
      <Field id="chat-subject" label="Subject (optional)">
        <Input id="chat-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </Field>
      <Field id="chat-message" label="Message">
        <Textarea
          id="chat-message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" disabled={busy || message.trim().length === 0}>
        <Send /> Send
      </Button>
    </form>
  );
}

function Thread({
  channelKey,
  token,
  conversation,
}: {
  channelKey: string;
  token: string;
  conversation: PublicConversation;
}) {
  const [messages, setMessages] = useState<PublicMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // `after` keeps polling cheap: each tick asks only for what arrived since.
  const lastAt = useRef<string | null>(null);

  const pull = useCallback(async () => {
    try {
      const batch = await chatApi.listMessages(channelKey, token, conversation.id, lastAt.current);
      if (batch.length === 0) return;
      lastAt.current = batch[batch.length - 1]!.created_at;
      setMessages((current) => {
        const seen = new Set(current.map((message) => message.id));
        return [...current, ...batch.filter((message) => !seen.has(message.id))];
      });
    } catch {
      // Keep the thread on screen; the next tick will try again.
    }
  }, [channelKey, token, conversation.id]);

  useEffect(() => {
    void pull();
    const timer = setInterval(() => void pull(), POLL_MS);
    return () => clearInterval(timer);
  }, [pull]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      const message = await chatApi.sendMessage(channelKey, token, conversation.id, body);
      lastAt.current = message.created_at;
      setMessages((current) => [...current, message]);
      setDraft('');
    } catch (cause) {
      setError(cause instanceof ChatApiError ? cause.message : 'Could not send that message.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex max-h-96 min-h-48 flex-col gap-3 overflow-y-auto">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            side={message.author_type === 'contact' ? 'right' : 'left'}
          />
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex flex-col gap-2 border-t pt-3">
        <Textarea
          rows={3}
          aria-label="Message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
        />
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" size="sm" disabled={busy || draft.trim().length === 0}>
          <Send /> Send
        </Button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Chrome                                                                      */
/* -------------------------------------------------------------------------- */

function Shell({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string | null;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background text-foreground mx-auto flex h-full max-w-md flex-col">
      <header className="flex items-center gap-2 border-b px-4 py-3">
        {onBack ? (
          <Button size="sm" variant="ghost" onClick={onBack} aria-label="Back">
            <ArrowLeft />
          </Button>
        ) : null}
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          {subtitle ? <p className="text-muted-foreground truncate text-xs">{subtitle}</p> : null}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

/** `id` ties the label to its control, the same way the CRM's own forms do. */
function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>;
}
