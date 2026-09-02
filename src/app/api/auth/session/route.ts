import { NextResponse } from 'next/server';

import { authEnabled, authProvider } from '@/lib/auth/registry';
import { sessionFromRequest } from '@/lib/auth/session';

/**
 * Who is signed in, for the client.
 *
 * The session cookie is http-only, so the browser cannot read it and the UI has
 * to ask. `auth_enabled: false` is the answer that tells the user menu to keep
 * offering the per-browser identity the app has always had.
 */
export async function GET(request: Request) {
  const provider = authProvider();
  const session = sessionFromRequest(request);

  return NextResponse.json({
    auth_enabled: authEnabled(),
    provider: { id: provider.id, label: provider.label },
    user: session
      ? {
          id: session.user_id,
          name: session.name,
          email: session.email,
          picture_url: session.picture_url,
        }
      : null,
  });
}
