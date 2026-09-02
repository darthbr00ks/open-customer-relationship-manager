import { NextResponse } from 'next/server';

import { permissionCatalog } from '@/lib/security/catalog';

export const dynamic = 'force-dynamic';

/**
 * Everything there is to permission: each object and its fields.
 *
 * Derived from the registered resources rather than stored, so the editor can
 * never offer a field that does not exist or miss one that does. Not scoped to
 * a workspace, and not sensitive: it is the shape of the app, which anyone who
 * can call the API already knows.
 */
export async function GET() {
  return NextResponse.json({ objects: permissionCatalog() });
}
