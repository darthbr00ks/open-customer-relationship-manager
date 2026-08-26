'use client';

import { Lock } from 'lucide-react';

import { formatRelativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

export type ThreadMessage = {
  id: string;
  author_type: 'contact' | 'user' | 'system';
  author_name?: string | null;
  body: string;
  created_at: string;
  is_internal?: boolean;
};

/**
 * One message, rendered the same way on both sides of the conversation — the
 * agent inbox and the customer widget pass the same shape, and only `side`
 * differs, so a thread reads identically wherever it is shown.
 */
export function MessageBubble({ message, side }: { message: ThreadMessage; side: 'left' | 'right' }) {
  if (message.author_type === 'system') {
    return (
      <p className="text-muted-foreground py-1 text-center text-xs">{message.body}</p>
    );
  }

  const mine = side === 'right';

  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'max-w-[42rem] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap',
          message.is_internal
            ? 'border border-dashed bg-amber-500/10'
            : mine
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted',
        )}
      >
        {message.body}
      </div>
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        {message.is_internal ? <Lock className="size-3" /> : null}
        {message.is_internal ? 'Internal note · ' : ''}
        {message.author_name || (message.author_type === 'contact' ? 'Visitor' : 'Support')} ·{' '}
        {formatRelativeTime(message.created_at)}
      </p>
    </div>
  );
}
