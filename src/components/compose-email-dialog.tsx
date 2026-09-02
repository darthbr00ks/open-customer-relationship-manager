'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError } from '@/lib/api-client';
import { invalidateList } from '@/lib/data-cache';
import {
  fetchEmailSettings,
  sendEmailMessage,
  type EmailAccountSummary,
} from '@/lib/email/client';
import type { NoteParentType } from '@/lib/objects';
import { useCurrentUserStore } from '@/stores/current-user';

/**
 * Compose and send one message from a record.
 *
 * Opened from a record header, so it already knows who it is writing to and
 * what to file the result against — the two things that make emailing from a
 * CRM worth doing rather than switching to a mail client.
 *
 * A failed send stays on screen with the provider's own reason. Closing the
 * dialog on failure would throw away what the user typed, which is exactly when
 * they least want to lose it.
 */
export function ComposeEmailDialog({
  open,
  onOpenChange,
  workspaceId,
  to,
  parentType,
  parentId,
  subject: initialSubject = '',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  /** Pre-filled recipient — the record's own address, when it has one. */
  to?: string | null;
  parentType: NoteParentType;
  parentId: string;
  subject?: string;
}) {
  const currentUserId = useCurrentUserStore((state) => state.userId);

  const [accounts, setAccounts] = useState<EmailAccountSummary[] | null>(null);
  const [accountId, setAccountId] = useState<string>('');
  const [form, setForm] = useState({
    to: to ?? '',
    cc: '',
    subject: initialSubject,
    body_text: '',
  });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      try {
        const settings = await fetchEmailSettings(workspaceId);
        if (cancelled) return;
        const usable = settings.accounts.filter((account) => account.status === 'connected');
        setAccounts(usable);
        setAccountId((current) => current || usable[0]?.id || '');
      } catch (caught) {
        if (!cancelled) {
          setAccounts([]);
          setError(caught instanceof ApiError ? String(caught.detail) : 'Could not load mailboxes');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, workspaceId]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const canSend =
    !sending && accountId !== '' && form.to.trim() !== '' && form.subject.trim() !== '' && form.body_text.trim() !== '';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setError(null);

    try {
      const message = await sendEmailMessage({
        workspace_id: workspaceId,
        account_id: accountId,
        to: form.to,
        cc: form.cc || undefined,
        subject: form.subject,
        body_text: form.body_text,
        parent_type: parentType,
        parent_id: parentId,
        created_by_user_id: currentUserId,
      });

      if (message.status !== 'sent') {
        setError(message.error ?? 'The provider would not accept the message.');
        return;
      }

      // The send files a system note on this record, so the Activity tab has to
      // re-read rather than show a timeline that is one entry out of date.
      invalidateList('notes', workspaceId);
      onOpenChange(false);
      setForm({ to: to ?? '', cc: '', subject: initialSubject, body_text: '' });
    } catch (caught) {
      setError(caught instanceof ApiError ? String(caught.detail) : 'Sending failed');
    } finally {
      setSending(false);
    }
  };

  const noMailbox = accounts !== null && accounts.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Send email</DialogTitle>
        </DialogHeader>

        {noMailbox ? (
          <div className="space-y-3 py-2">
            <p className="text-sm">No mailbox is connected to this workspace yet.</p>
            <Button asChild variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              <Link href="/settings/email">Connect one</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="compose-from">From</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger id="compose-from" className="w-full">
                  <SelectValue placeholder={accounts === null ? 'Loading mailboxes…' : 'Pick a mailbox'} />
                </SelectTrigger>
                <SelectContent>
                  {(accounts ?? []).map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.display_name ? `${account.display_name} <${account.email}>` : account.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="compose-to">To</Label>
                <Input
                  id="compose-to"
                  value={form.to}
                  onChange={(event) => set('to', event.target.value)}
                  placeholder="someone@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compose-cc">Cc</Label>
                <Input
                  id="compose-cc"
                  value={form.cc}
                  onChange={(event) => set('cc', event.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compose-subject">Subject</Label>
              <Input
                id="compose-subject"
                value={form.subject}
                onChange={(event) => set('subject', event.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="compose-body">Message</Label>
              <Textarea
                id="compose-body"
                rows={10}
                value={form.body_text}
                onChange={(event) => set('body_text', event.target.value)}
              />
            </div>

            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSend}>
                {sending ? 'Sending…' : 'Send'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
