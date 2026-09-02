'use client';

import { EditableField } from '@/components/fields/editable-field';
import type { ResourceName } from '@/lib/api/resources';
import type { ObjectLayout } from '@/lib/schema/types';
import { fieldIsVisible, usePermissions } from '@/stores/permissions';
import { useUIStore } from '@/stores/ui';

/**
 * Renders a record's fields grouped into the sections its layout defines.
 * Every editable field can be double-clicked into an inline
 * editor — the full create/edit dialog is still there for editing several
 * fields at once, but a single wrong value shouldn't need it.
 */
export function RecordOverview({
  layout,
  row,
  workspaceId,
  resource,
  recordId,
}: {
  layout: ObjectLayout;
  row: Record<string, unknown>;
  workspaceId: string | null;
  resource: ResourceName;
  recordId: string;
}) {
  const sectionColumns = useUIStore((state) => state.sectionColumns);
  const permissions = usePermissions();

  // A hidden field is not rendered at all — not even its label. Showing "Amount"
  // above an empty value tells the reader exactly what they were not allowed to
  // see, and a section left with nothing in it is dropped with it.
  const sections = layout.sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => fieldIsVisible(permissions, resource, field.key)),
    }))
    .filter((section) => section.fields.length > 0);

  return (
    <div className="flex flex-col" style={{ gap: 'var(--d-gap-section)' }}>
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">{section.title}</h3>
          <div className="overflow-x-auto">
            <div
              className="grid"
              style={{
                rowGap: 'var(--d-gap-field)',
                columnGap: '2rem',
                gridTemplateColumns: `repeat(${sectionColumns}, minmax(160px, 1fr))`,
              }}
            >
              {section.fields.map((field) => (
                <div key={field.key} style={field.type === 'longtext' ? { gridColumn: '1 / -1' } : undefined}>
                  <dt className="text-muted-foreground text-xs">{field.label}</dt>
                  <dd style={{ fontSize: 'var(--d-font)' }} className="mt-0.5">
                    <EditableField
                      field={field}
                      value={row[field.key]}
                      workspaceId={workspaceId}
                      resource={resource}
                      recordId={recordId}
                    />
                  </dd>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
