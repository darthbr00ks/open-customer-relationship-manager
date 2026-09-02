import { NextResponse, type NextRequest } from 'next/server';

import { authEnabled } from '@/lib/auth/registry';
import { sessionFromRequest } from '@/lib/auth/session';

/**
 * The route guard. (Next.js 16 renamed Middleware to Proxy; same mechanism.)
 *
 * This is an *optimistic* check, in the sense the Next.js docs use: it keeps a
 * signed-out browser from landing on a CRM screen, and nothing more. It is not
 * the authorization boundary — a cookie is only checked for a valid signature
 * here, and anything that matters is re-checked in the handler that does the
 * work (`src/lib/auth/current-user.ts`). Proxy runs on every matched request,
 * so it must not query a database.
 *
 * With no identity provider configured, `authEnabled()` is false and this steps
 * aside entirely: the app runs exactly as it did before, which is what keeps a
 * fresh clone usable.
 */
export function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  if (sessionFromRequest(request)) return NextResponse.next();

  const signIn = new URL('/sign-in', request.nextUrl.origin);
  // Carry where they were going, so signing in resumes it instead of dropping
  // them on the home page.
  const from = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (from && from !== '/') signIn.searchParams.set('return_to', from);

  return NextResponse.redirect(signIn);
}

export const config = {
  /**
   * Everything except:
   *
   * - `api/auth/*` — the sign-in flow itself, which by definition runs signed out.
   * - `api/chat/*` — the customer-facing widget. Visitors are not CRM users;
   *   they authenticate against a channel (`src/lib/chat/session.ts`), and
   *   guarding these routes would take the widget off every customer's site.
   * - `chat/widget/*` — the page that widget renders in, for the same reason.
   * - `sign-in` — where this redirects to.
   * - Next.js internals and static files.
   *
   * `api/v1/*` is deliberately included: the REST API is what the UI calls, and
   * leaving it open would make the guard decorative.
   */
  matcher: [
    '/((?!api/auth|api/chat|chat/widget|sign-in|_next/static|_next/image|favicon.ico).*)',
  ],
};
