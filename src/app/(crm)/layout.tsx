import { AppShell } from '@/components/app-shell';
import { SessionProvider } from '@/components/session-provider';

/**
 * The signed-in CRM: every screen a workspace's own users see, wrapped in the
 * app shell. The customer-facing chat widget deliberately sits outside this
 * group — it renders inside someone else's page and must not carry the CRM's
 * navigation with it.
 */
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Reports who is signed in into the client store the whole shell reads.
          Scoped to this group: the chat widget has visitors, not CRM users. */}
      <SessionProvider />
      <AppShell>{children}</AppShell>
    </>
  );
}
