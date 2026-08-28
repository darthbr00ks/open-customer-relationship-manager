import { collectionHandlers } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';

export const dynamic = 'force-dynamic';

export const { GET, POST } = collectionHandlers(resources['price-books']);
