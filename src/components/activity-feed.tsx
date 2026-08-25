'use client';

import { History, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatDateTime, formatRelativeTime, initials } from '@/lib/format';
import type { NoteParentType } from '@/lib/objects';
import type { Note } from '@/lib/types';
import { useCurrentUserStore } from '@/stores/current-user';
import { useUserLabel } from '@/hooks/use-user-label';

/**
 * Chronological feed for a record (spec §10). Backed by the `Note` model —
 * `kind: 'system'` rows are written by contextual actions (stage changes,
 * closing a deal, etc) alongside hand-written `kind: 'note'` rows, so one
 * feed shows both. The Notes tab is the same feed with `filter="notes"`.
 */
export function ActivityFeed({
  parentType,
  parentId,
  workspaceId,
  filter = 'all',
}: {
  parentType: NoteParentType;
  parentId: string;
  workspaceId: string;
  filter?: 'all' | 'notes';
}) {
  const { rows, loading } = useCachedList<Note>('notes', workspaceId, { limit: 200, includeArchived: true });
  const currentUser = useCurrentUserStore();
  const userLabel = useUserLabel();
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const entries = rows
    .filter((note) => note.parent_type === parentType && note.parent_id === parentId)
    .filter((note) => filter === 'all' || note.kind === 'note')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const post = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      await api.create('notes', {
        workspace_id: workspaceId,
        parent_type: parentType,
        parent_id: parentId,
        kind: 'note',
        body: draft.trim(),
        created_by_user_id: currentUser.userId,
      });
      invalidateList('notes', workspaceId);
      setDraft('');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex gap-3">
        <Avatar className="mt-0.5">
          <AvatarFallback>{initials(currentUser.displayName)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={filter === 'notes' ? 'Add a note…' : 'Log a note, call, or update…'}
            rows={2}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={() => void post()} disabled={posting || !draft.trim()}>
              <MessageSquarePlus /> Add note
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {filter === 'notes' ? 'No notes yet.' : 'No activity yet.'}
          </p>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="flex gap-3">
              {entry.kind === 'system' ? (
                <div className="bg-muted mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                  <History className="text-muted-foreground size-4" />
                </div>
              ) : (
                <Avatar className="mt-0.5">
                  <AvatarFallback>{initials(userLabel(entry.created_by_user_id))}</AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-medium">{userLabel(entry.created_by_user_id)}</span>{' '}
                  <span className="text-muted-foreground">{entry.kind === 'system' ? '' : 'added a note'}</span>
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap">{entry.body}</p>
                <p className="text-muted-foreground mt-1 text-xs" title={formatDateTime(entry.created_at)}>
                  {formatRelativeTime(entry.created_at)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
