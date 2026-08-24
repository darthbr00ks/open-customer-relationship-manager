export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="text-muted-foreground mt-1 text-sm">{hint}</p> : null}
    </div>
  );
}

export function NoWorkspace() {
  return (
    <EmptyState
      title="No workspace selected"
      hint="Enter a workspace id in the header, or press New to generate one."
    />
  );
}
