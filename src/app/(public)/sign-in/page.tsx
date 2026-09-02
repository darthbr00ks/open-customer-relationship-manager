import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authEnabled, authProvider } from '@/lib/auth/registry';

/**
 * The sign-in screen.
 *
 * Deliberately not a form: this app never sees a password. The button starts
 * the authorization-code flow at `/api/auth/login`, and the identity provider
 * owns everything from there — which is what makes MFA, SSO, and password
 * policy someone else's problem.
 *
 * It sits in `(public)` because the route guard sends unauthenticated browsers
 * here, so it cannot be behind the guard or inside the app shell.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string; error?: string }>;
}) {
  const { return_to, error } = await searchParams;
  const provider = authProvider();
  const enabled = authEnabled();

  const loginHref = return_to
    ? `/api/auth/login?return_to=${encodeURIComponent(return_to)}`
    : '/api/auth/login';

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Sign in to open-rm</CardTitle>
          <CardDescription>
            {enabled
              ? `You'll be taken to ${provider.label} to sign in.`
              : 'No identity provider is configured, so this deployment does not require signing in.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="border-destructive/40 text-destructive rounded-md border border-dashed p-3 text-sm"
            >
              {error}
            </p>
          ) : null}

          {enabled ? (
            <Button asChild className="w-full">
              <a href={loginHref}>Continue with {provider.label}</a>
            </Button>
          ) : (
            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Open the CRM</Link>
              </Button>
              <p className="text-muted-foreground text-xs">
                To require sign-in, set <code>AUTH_PROVIDER=auth0</code> and the{' '}
                <code>AUTH0_*</code> variables — see the README.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
