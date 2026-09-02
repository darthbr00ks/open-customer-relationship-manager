'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Mail, Plug, Unplug } from 'lucide-react';

import { EmptyState, NoWorkspace } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ApiError } from '@/lib/api-client';
import type { EmailSettings } from '@/lib/email/client';
import { fetchEmailSettings, disconnectEmailAccount } from '@/lib/email/client';
import { useWorkspaceStore } from '@/stores/workspace';

/**
 * Settings → Email: connect a mailbox, see what is connected, disconnect one.
 *
 * The page is as much about explaining the setup as performing it. A mailbox
 * that will not connect is nearly always a missing client id or a missing
 * encryption key, and the server reports both, so they are shown here rather
 * than surfacing as a failed redirect the user has no way to interpret.
 *
 * The Suspense boundary is required, not decorative: the body reads the OAuth
 * callback's outcome with `useSearchParams`, and a page that does that cannot
 * be prerendered without one.
 */
export default function EmailSettingsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground text-sm">Loading email settings…</p>}>
      <EmailSettings />
    </Suspense>
  );
}

function EmailSettings() {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const params = useSearchParams();

  const [settings, setSettings] = useState<EmailSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /** Bumped to re-read after a disconnect; the effect below is the only fetcher. */
  const [reloadToken, setReloadToken] = useState(0);

  // The OAuth callback redirects back here with its outcome in the query string,
  // because a consent screen has nowhere to return JSON to.
  const connected = params.get('connected');
  const connectError = params.get('connect_error');

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    (async () => {
      try {
        const loaded = await fetchEmailSettings(workspaceId);
        if (cancelled) return;
        setSettings(loaded);
        setError(null);
      } catch (caught) {
        if (cancelled) return;
        setError(
          caught instanceof ApiError ? String(caught.detail) : 'Could not load email settings',
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, reloadToken]);

  if (!workspaceId) return <NoWorkspace />;

  const provider = settings?.provider;
  const canConnect =
    provider?.requires_connected_account &&
    provider.configured &&
    settings?.encryption_key_configured;

  const disconnect = async (id: string) => {
    setBusyId(id);
    try {
      await disconnectEmailAccount(workspaceId, id);
      setReloadToken((token) => token + 1);
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.detail) : 'Disconnecting failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connect a mailbox and the CRM can send from it — from a Person, an Entity, or a Case.
        </p>
      </div>

      {connected ? (
        <Notice tone="ok" icon={CheckCircle2}>
          Connected <strong>{connected}</strong>. You can now send from this workspace.
        </Notice>
      ) : null}
      {connectError ? (
        <Notice tone="error" icon={AlertTriangle}>
          {connectError}
        </Notice>
      ) : null}
      {error ? (
        <Notice tone="error" icon={AlertTriangle}>
          {error}
        </Notice>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="size-4" /> Provider
          </CardTitle>
          <CardDescription>
            {provider
              ? `This server sends through ${provider.label}.`
              : 'Loading the mail provider…'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {provider && !provider.configured ? (
            <p className="text-muted-foreground text-sm">
              {provider.label} is not configured. Set its credentials in the environment — see
              the README — and restart the server.
            </p>
          ) : null}
          {settings && !settings.encryption_key_configured && provider?.requires_connected_account ? (
            <p className="text-muted-foreground text-sm">
              <code>SECRET_ENCRYPTION_KEY</code> is not set, so a mailbox grant cannot be stored
              safely. Generate one with <code>openssl rand -base64 32</code>.
            </p>
          ) : null}
          {provider && !provider.requires_connected_account ? (
            <p className="text-muted-foreground text-sm">
              {provider.label} sends with credentials from the environment, so there is no mailbox
              to connect.
            </p>
          ) : null}

          {canConnect ? (
            // A plain link, not fetch: the browser has to *leave* for the
            // provider's consent screen, which XHR cannot do.
            <Button asChild>
              <a
                href={`/api/v1/email/connect?workspace_id=${encodeURIComponent(workspaceId)}`}
              >
                <Plug /> Connect a {provider.label} mailbox
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected mailboxes</CardTitle>
          <CardDescription>Mail this workspace can send from.</CardDescription>
        </CardHeader>
        <CardContent>
          {settings && settings.accounts.length === 0 ? (
            <EmptyState
              title="No mailbox connected"
              hint={
                canConnect
                  ? 'Connect one above to start sending from the CRM.'
                  : 'Configure a provider first.'
              }
            />
          ) : (
            <ul className="divide-y">
              {(settings?.accounts ?? []).map((account) => (
                <li key={account.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{account.email}</span>
                      <Badge variant={account.status === 'connected' ? 'secondary' : 'destructive'}>
                        {account.status === 'connected' ? 'Connected' : 'Needs reconnecting'}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {account.provider_label}
                      {account.display_name ? ` · ${account.display_name}` : ''} · connected{' '}
                      {new Date(account.connected_at).toLocaleDateString()}
                    </p>
                    {account.last_error ? (
                      <p className="text-destructive mt-1 text-xs">{account.last_error}</p>
                    ) : null}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === account.id}
                    onClick={() => void disconnect(account.id)}
                  >
                    <Unplug /> {busyId === account.id ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Separator />

      <p className="text-muted-foreground text-xs">
        Sending is provider-agnostic: everything above goes through the{' '}
        <code>EmailProvider</code> interface in <code>src/lib/email/types.ts</code>, so swapping
        Gmail for Microsoft 365 or an SMTP relay is one file and one registry entry.
      </p>
    </div>
  );
}

function Notice({
  tone,
  icon: Icon,
  children,
}: {
  tone: 'ok' | 'error';
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2 rounded-md border border-dashed p-3 text-sm ${
        tone === 'error' ? 'border-destructive/40 text-destructive' : 'text-muted-foreground'
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
