'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function EmailComposerDialog({
  open,
  onOpenChange,
  workspaceId,
  recipient,
  defaultSubject,
  relatedDealId,
  relatedPersonId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  recipient: string;
  defaultSubject: string;
  relatedDealId?: string;
  relatedPersonId?: string;
}) {
  const [to, setTo] = useState(recipient);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepare() {
    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/email/outbound/prepare', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          to_address: to,
          subject,
          text_body: body,
          related_deal_id: relatedDealId,
          related_person_id: relatedPersonId,
        }),
      });
      const result = (await response.json()) as { detail?: unknown; external_reference_id?: string };
      if (!response.ok || !result.external_reference_id) {
        throw new Error(typeof result.detail === 'string' ? result.detail : 'Could not prepare email');
      }
      const referencedBody = `${body}${body ? '\n\n' : ''}ref:crm:${result.external_reference_id}`;
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(referencedBody)}`;
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare email');
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send email</DialogTitle>
          <DialogDescription>
            Compose here, then continue in your default mail app. OpenRM adds a conversation reference for reply matching.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-to">To</Label>
            <Input id="email-to" type="email" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input id="email-subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Message</Label>
            <Textarea id="email-body" rows={10} value={body} onChange={(event) => setBody(event.target.value)} />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={sending || !to || !subject} onClick={() => void prepare()}>
            {sending ? 'Preparing…' : 'Continue to mail app'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

