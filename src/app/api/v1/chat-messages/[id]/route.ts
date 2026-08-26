import { itemHandlers } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';

export const dynamic = 'force-dynamic';

/**
 * Read only: a message is the record of something that was said, so there is
 * no PATCH, PUT, or DELETE here — the other verbs answer 405.
 */
export const { GET } = itemHandlers(resources['chat-messages']);
