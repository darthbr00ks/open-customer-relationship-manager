'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Archive, ArchiveRestore, ExternalLink, MessagesSquare, Pencil, Power, PowerOff } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { NoWorkspace } from '@/components/empty-state';
import { RecordFormDialog } from '@/components/record-form-dialog';
import { RecordHeader, type RecordAction } from '@/components/record-header';
import { RecordOverview } from '@/components/record-overview';
import { RecordTabs } from '@/components/record-tabs';
import { RelatedList } from '@/components/related-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api-client';
import { contactDisplayName } from '@/lib/chat/display';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatLabel, formatRelativeTime } from '@/lib/format';
import { chatAuthTone, chatIntakeTone } from '@/lib/schema/chat-channel';
import { OBJECTS } from '@/lib/objects';
import type { ChatChannel, ChatContact, ChatConversation } from '@/lib/types';
import { useWorkspaceStore } from '@/stores/workspace';

const object = OBJECTS.chat_channels;

export default function ChatChannelRecordPage() {
  const { id } = useParams<{ id: string }>();
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);

  const { rows: channels, loading } = useCachedList<ChatChannel>('chat-channels', workspaceId, {
    includeArchived: true,
  });
  const { rows: conversations } = useCachedList<ChatConversation>('chat-conversations', workspaceId, {
    limit: 200,
  });
  const { rows: contacts } = useCachedList<ChatContact>('chat-contacts', workspaceId, { limit: 200 });

  const [editing, setEditing] = useState(false);

  if (!workspaceId) return <NoWorkspace />;
  const channel = channels.find((row) => row.id === id);
  if (!channel) {
    return (
      <p className="text-muted-foreground text-sm">
        {loading ? 'Loading…' : 'Chat channel not found in this workspace.'}
      </p>
    );
  }

  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));
  const channelConversations = conversations.filter((row) => row.channel_id === channel.id);

  const toggleArchive = async () => {
    if (channel.archived_at) await api.update('chat-channels', channel.id, workspaceId, { archived_at: null });
    else await api.archive('chat-channels', channel.id, workspaceId);
    invalidateList('chat-channels', workspaceId);
  };

  const toggleEnabled = async () => {
    await api.update('chat-channels', channel.id, workspaceId, { is_enabled: !channel.is_enabled });
    invalidateList('chat-channels', workspaceId);
  };

  const actions: RecordAction[] = [
    { key: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditing(true), primary: true },
    channel.is_enabled
      ? { key: 'disable', label: 'Disable', icon: PowerOff, onClick: () => void toggleEnabled() }
      : { key: 'enable', label: 'Enable', icon: Power, onClick: () => void toggleEnabled() },
    channel.archived_at
      ? { key: 'unarchive', label: 'Unarchive', icon: ArchiveRestore, onClick: () => void toggleArchive() }
      : { key: 'archive', label: 'Archive', icon: Archive, onClick: () => void toggleArchive(), variant: 'destructive' },
  ];

  return (
    <div>
      <RecordHeader
        title={channel.name}
        archived={Boolean(channel.archived_at)}
        actions={actions}
        badges={
          <>
            <span className="font-mono text-xs">{channel.key}</span>
            <span>·</span>
            <Badge variant={chatIntakeTone(channel.intake_mode)}>
              {channel.intake_mode === 'none' ? 'Conversation only' : `Creates ${formatLabel(channel.intake_mode)}`}
            </Badge>
            <Badge variant={chatAuthTone(channel.auth_mode)}>
              {channel.auth_mode === 'required'
                ? 'Sign-in required'
                : channel.auth_mode === 'optional'
                  ? 'Sign-in optional'
                  : 'No sign-in'}
            </Badge>
            {channel.is_enabled ? null : <Badge variant="secondary">Disabled</Badge>}
          </>
        }
      />

      <RecordTabs
        noteParentType="chat_channel"
        recordId={channel.id}
        workspaceId={workspaceId}
        overview={
          <RecordOverview
            layout={object.layout}
            row={channel}
            workspaceId={workspaceId}
            resource={object.resource}
            recordId={channel.id}
          />
        }
        related={
          <>
            <EmbedCard channelKey={channel.key} />
            <RelatedList
              title="Conversations"
              icon={MessagesSquare}
              rows={channelConversations}
              href={() => '/chat'}
              emptyLabel="No one has used this channel yet."
              columns={[
                {
                  key: 'contact',
                  label: 'Visitor',
                  render: (row) => contactDisplayName(contactsById.get(row.contact_id)),
                },
                { key: 'subject', label: 'Subject', render: (row) => row.subject },
                { key: 'status', label: 'Status', render: (row) => <Badge variant="outline">{formatLabel(row.status)}</Badge> },
                {
                  key: 'last_message_at',
                  label: 'Last message',
                  render: (row) => formatRelativeTime(row.last_message_at),
                },
              ]}
            />
          </>
        }
      />

      {editing ? (
        <RecordFormDialog
          open
          onOpenChange={setEditing}
          objectKey="chat_channels"
          mode="edit"
          workspaceId={workspaceId}
          recordId={channel.id}
          initialValues={channel}
        />
      ) : null}
    </div>
  );
}

/** The origin never changes for the life of the page, so there is nothing to subscribe to. */
const subscribeToNothing = () => () => {};

/**
 * How to put this channel on a website. The origin is read in the browser
 * rather than configured, so the snippet is correct for wherever this app is
 * actually being served from.
 */
function EmbedCard({ channelKey }: { channelKey: string }) {
  const [copied, setCopied] = useState(false);
  // Read the browser's origin without a hydration mismatch: empty on the
  // server, the real value once mounted, and no state to keep in sync.
  const origin = useSyncExternalStore(
    subscribeToNothing,
    () => window.location.origin,
    () => '',
  );

  const url = `${origin}/chat/widget/${channelKey}`;
  const snippet = `<iframe src="${url}" title="Chat" width="400" height="600" style="border:0;border-radius:12px"></iframe>`;

  const copy = async () => {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Embed</h3>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy snippet'}
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/chat/widget/${channelKey}`} target="_blank">
              <ExternalLink /> Open widget
            </Link>
          </Button>
        </div>
      </div>
      <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs">{snippet}</pre>
      <p className="text-muted-foreground mt-2 text-xs">
        Restrict who may embed it with the channel&apos;s allowed origins.
      </p>
    </section>
  );
}
