import { itemHandlers } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';

export const dynamic = 'force-dynamic';

export const { GET, PATCH, PUT, DELETE } = itemHandlers(resources['products']);
