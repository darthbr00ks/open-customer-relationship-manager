'use client';

import { FieldValue } from '@/components/fields/field-value';
import type { ObjectLayout } from '@/lib/schema/types';

/** Renders a record's fields grouped into the sections its layout defines (spec §6/§7). */
export function RecordOverview({
  layout,
  row,
  workspaceId,
}: {
  layout: ObjectLayout;
  row: Record<string, unknown>;
  workspaceId: string | null;
}) {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--d-gap-section)' }}>
      {layout.sections.map((section) => (
        <section key={section.title}>
          <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">{section.title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ rowGap: 'var(--d-gap-field)', columnGap: '2rem' }}>
            {section.fields.map((field) => (
              <div key={field.key} className={field.type === 'longtext' ? 'sm:col-span-2' : undefined}>
                <dt className="text-muted-foreground text-xs">{field.label}</dt>
                <dd style={{ fontSize: 'var(--d-font)' }} className="mt-0.5">
                  <FieldValue field={field} value={row[field.key]} workspaceId={workspaceId} />
                </dd>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
