'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { logSystemNote } from '@/lib/activity';
import { invalidateList } from '@/lib/data-cache';
import { formatLabel } from '@/lib/format';
import { DEAL_STAGES } from '@/lib/types';
import { useCurrentUserStore } from '@/stores/current-user';

/** "Change Stage" (spec §11) — moves the deal and drops a system note recording the move. */
export function ChangeStageDialog({
  open,
  onOpenChange,
  dealId,
  currentStage,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  currentStage: string;
  workspaceId: string;
}) {
  const currentUser = useCurrentUserStore();
  const [stage, setStage] = useState(currentStage);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.update('deals', dealId, workspaceId, { stage, updated_by_user_id: currentUser.userId });
      if (stage !== currentStage) {
        await logSystemNote(workspaceId, 'deal', dealId, `Stage changed from ${formatLabel(currentStage)} → ${formatLabel(stage)}`, currentUser.userId);
      }
      invalidateList('deals', workspaceId);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Change stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** "Close Lost" (spec §11) — asks why, since a lost reason is how a pipeline report explains itself later. */
export function CloseLostDialog({
  open,
  onOpenChange,
  dealId,
  workspaceId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string;
  workspaceId: string;
}) {
  const currentUser = useCurrentUserStore();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.update('deals', dealId, workspaceId, {
        stage: 'lost',
        closed_at: new Date().toISOString(),
        lost_reason: reason || undefined,
        updated_by_user_id: currentUser.userId,
      });
      await logSystemNote(workspaceId, 'deal', dealId, `Closed as Lost${reason ? `: ${reason}` : ''}`, currentUser.userId);
      invalidateList('deals', workspaceId);
      onOpenChange(false);
      setReason('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Close as lost</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="lost-reason">Reason</Label>
            <Textarea id="lost-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={saving}>
              {saving ? 'Saving…' : 'Close as lost'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export async function closeDealWon(dealId: string, workspaceId: string, userId: string) {
  await api.update('deals', dealId, workspaceId, {
    stage: 'won',
    closed_at: new Date().toISOString(),
    updated_by_user_id: userId,
  });
  await logSystemNote(workspaceId, 'deal', dealId, 'Closed as Won 🎉', userId);
  invalidateList('deals', workspaceId);
}
