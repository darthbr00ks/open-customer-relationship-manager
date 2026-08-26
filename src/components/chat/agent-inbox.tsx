'use client';

import Link from 'next/link';
import { LayoutGrid, LifeBuoy, Lock, MessagesSquare, Send, Settings2, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { MessageBubble } from '@/components/chat/message-bubble';
import { NoWorkspace } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api-client';
import { contactDisplayName } from '@/lib/chat/display';
import { invalidateList, useCachedList } from '@/lib/data-cache';
import { formatLabel, formatRelativeTime } from '@/lib/format';
import { CHAT_CONVERSATION_STATUSES, type ChatChannel, type ChatContact, type ChatConversation, type ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCurrentUserStore } from '@/stores/current-user';
import { useWorkspaceStore } from '@/stores/workspace';

/** How often the inbox re-reads the thread it is showing. */
const POLL_MS = 8000;

/**
 * The workspace's side of every chat channel: one list of live conversations,
 * the thread for whichever is selected, and a composer that can send either a
 * reply the customer sees or an internal note only colleagues see.
 */
export function AgentInbox() {
  const workspaceId = useWorkspaceStore((state) => state.workspaceId);
  const currentUserId = useCurrentUserStore((state) => state.userId);
  const currentUserName = useCurrentUserStore((state) => state.displayName);

  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { rows: channels } = useCachedList<ChatChannel>('chat-channels', workspaceId, { includeArchived: true });
  const { rows: contacts } = useCachedList<ChatContact>('chat-contacts', workspaceId, { limit: 200 });
  const { rows: conversations, loading, refresh } = useCachedList<ChatConversation>(
    'chat-conversations',
    workspaceId,
    { limit: 200 },
  );

  const selected = conversations.find((row) => row.id === selectedId) ?? null;

  // Passing a null workspace keeps the hook from fetching every message in the
  // workspace while no thread is selected.
  const { rows: threadRows, refresh: refreshThread } = useCachedList<ChatMessage>(
    'chat-messages',
    selectedId ? workspaceId : null,
    { limit: 200, filters: selectedId ? { conversation_id: selectedId } : {} },
  );

  // The list endpoint returns newest first; a thread reads oldest first.
  const messages = useMemo(() => [...threadRows].reverse(), [threadRows]);

  useEffect(() => {
    const timer = setInterval(() => {
      refresh();
      refreshThread();
    }, POLL_MS);
    return () => clearInterval(timer);
    // `refresh` identity changes every render; the interval only needs to be set up once per selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, selectedId]);

  const channelsById = new Map(channels.map((channel) => [channel.id, channel]));
  const contactsById = new Map(contacts.map((contact) => [contact.id, contact]));

  const visible = conversations.filter((conversation) => {
    if (channelFilter !== 'all' && conversation.channel_id !== channelFilter) return false;
    if (statusFilter === 'active') return conversation.status !== 'closed';
    if (statusFilter === 'all') return true;
    return conversation.status === statusFilter;
  });

  const select = async (conversation: ChatConversation) => {
    setSelectedId(conversation.id);
    if (!workspaceId) return;
    if (hasUnread(conversation)) {
      await api.action('chat-conversations', conversation.id, 'read', workspaceId);
      invalidateList('chat-conversations', workspaceId);
    }
  };

  if (!workspaceId) return <NoWorkspace />;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <MessagesSquare className="size-6" /> Chat
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Conversations from every channel this workspace runs.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/chat/channels">
            <Settings2 /> Channels
          </Link>
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[20rem_1fr]">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {channels.map((channel) => (
                  <SelectItem key={channel.id} value={channel.id}>{channel.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Open &amp; pending</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
                {CHAT_CONVERSATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="divide-y overflow-hidden rounded-md border">
            {visible.length === 0 ? (
              <p className="text-muted-foreground p-4 text-sm">
                {loading ? 'Loading…' : 'No conversations match these filters.'}
              </p>
            ) : (
              visible.map((conversation) => {
                const contact = contactsById.get(conversation.contact_id);
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => void select(conversation)}
                    className={cn(
                      'hover:bg-accent block w-full px-3 py-2.5 text-left',
                      conversation.id === selectedId && 'bg-accent',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {contact ? contactDisplayName(contact) : 'Visitor'}
                      </span>
                      {hasUnread(conversation) ? (
                        <span className="bg-primary size-2 shrink-0 rounded-full" aria-label="Unread" />
                      ) : null}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{conversation.subject}</p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {channelsById.get(conversation.channel_id)?.name ?? 'Channel'} ·{' '}
                      {formatRelativeTime(conversation.last_message_at)}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {selected ? (
          <ConversationPanel
            key={selected.id}
            conversation={selected}
            channel={channelsById.get(selected.channel_id)}
            contact={contactsById.get(selected.contact_id)}
            messages={messages}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onChanged={() => {
              invalidateList('chat-conversations', workspaceId);
              refreshThread();
            }}
          />
        ) : (
          <div className="text-muted-foreground flex min-h-64 items-center justify-center rounded-md border text-sm">
            Select a conversation to read it.
          </div>
        )}
      </div>
    </div>
  );
}

/** A thread the workspace has not looked at since the customer last wrote. */
function hasUnread(conversation: ChatConversation): boolean {
  if (!conversation.last_contact_message_at) return false;
  if (!conversation.agent_read_at) return true;
  return new Date(conversation.last_contact_message_at) > new Date(conversation.agent_read_at);
}

function ConversationPanel({
  conversation,
  channel,
  contact,
  messages,
  workspaceId,
  currentUserId,
  currentUserName,
  onChanged,
}: {
  conversation: ChatConversation;
  channel?: ChatChannel;
  contact?: ChatContact;
  messages: ChatMessage[];
  workspaceId: string;
  currentUserId: string;
  currentUserName: string;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      await api.create('chat-messages', {
        workspace_id: workspaceId,
        conversation_id: conversation.id,
        body,
        author_user_id: currentUserId,
        author_name: currentUserName,
        is_internal: internal,
      });
      setDraft('');
      onChanged();
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (status: string) => {
    await api.update('chat-conversations', conversation.id, workspaceId, {
      status,
      closed_at: status === 'closed' ? new Date().toISOString() : null,
    });
    onChanged();
  };

  const assignToMe = async () => {
    await api.update('chat-conversations', conversation.id, workspaceId, { assigned_user_id: currentUserId });
    onChanged();
  };

  return (
    <div className="flex min-w-0 flex-col rounded-md border">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{conversation.subject}</p>
          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-2 text-xs">
            <span>{contact ? contactDisplayName(contact) : 'Visitor'}</span>
            {contact?.verified_at ? <Badge variant="outline">Verified</Badge> : null}
            <span>·</span>
            <span>{channel?.name ?? 'Channel'}</span>
            {conversation.deal_id ? (
              <Link href={`/deals/${conversation.deal_id}`} className="inline-flex items-center gap-1 underline">
                <LayoutGrid className="size-3" /> Deal
              </Link>
            ) : null}
            {conversation.case_id ? (
              <Link href={`/cases/${conversation.case_id}`} className="inline-flex items-center gap-1 underline">
                <LifeBuoy className="size-3" /> Case
              </Link>
            ) : null}
            {conversation.entity_id ? (
              <Link href={`/entities/${conversation.entity_id}`} className="underline">
                Organization
              </Link>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Select value={conversation.status} onValueChange={(value) => void setStatus(value)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {CHAT_CONVERSATION_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>{formatLabel(status)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => void assignToMe()}>
            <UserCheck /> Assign to me
          </Button>
        </div>
      </div>

      <div className="flex max-h-[28rem] min-h-64 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-sm">No messages yet.</p>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              side={message.author_type === 'contact' ? 'left' : 'right'}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="flex flex-col gap-2 border-t p-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          placeholder={internal ? 'Note for your colleagues…' : 'Reply to the customer…'}
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Switch id="internal" checked={internal} onCheckedChange={setInternal} />
            <Label htmlFor="internal" className="flex items-center gap-1 text-sm font-normal">
              <Lock className="size-3.5" /> Internal note
            </Label>
          </div>
          <Button type="submit" size="sm" disabled={sending || draft.trim().length === 0}>
            <Send /> {internal ? 'Add note' : 'Send reply'}
          </Button>
        </div>
      </form>
    </div>
  );
}
