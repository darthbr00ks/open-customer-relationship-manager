import type { Metadata } from 'next';

import { ChatWidget } from '@/components/chat/chat-widget';

export const metadata: Metadata = { title: 'Chat' };

/**
 * The page a customer sees — linked directly or embedded in an iframe on
 * someone else's site. It sits outside the `(crm)` route group so it carries
 * none of the CRM's navigation.
 */
export default async function ChatWidgetPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <ChatWidget channelKey={key} />;
}
