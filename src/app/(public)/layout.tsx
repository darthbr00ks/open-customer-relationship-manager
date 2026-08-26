/**
 * Screens shown to people who are not CRM users — currently the chat widget.
 * No app shell, no workspace: just the page, so it can live inside an iframe
 * on a customer's own site.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full min-h-screen">{children}</div>;
}
