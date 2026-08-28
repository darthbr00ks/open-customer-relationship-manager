import { archiveHandler } from '@/lib/api/resource';
import { resources } from '@/lib/api/resources';

export const dynamic = 'force-dynamic';

export const { POST } = archiveHandler(resources['quotes']);
