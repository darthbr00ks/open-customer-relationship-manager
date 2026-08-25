import { api } from '@/lib/api-client';
import { invalidateList } from '@/lib/data-cache';
import type { NoteParentType } from '@/lib/objects';

/** Records a system-authored timeline entry (a stage change, a close, etc) alongside hand-written notes. */
export async function logSystemNote(
  workspaceId: string,
  parentType: NoteParentType,
  parentId: string,
  body: string,
  userId: string,
) {
  await api.create('notes', {
    workspace_id: workspaceId,
    parent_type: parentType,
    parent_id: parentId,
    kind: 'system',
    body,
    created_by_user_id: userId,
  });
  invalidateList('notes', workspaceId);
}
