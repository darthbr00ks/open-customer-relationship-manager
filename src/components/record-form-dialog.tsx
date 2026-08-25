'use client';

import { useEffect, useRef, useState } from 'react';

import { FieldInput } from '@/components/fields/field-input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api, ApiError } from '@/lib/api-client';
import { invalidateList } from '@/lib/data-cache';
import { OBJECTS, type ObjectKey } from '@/lib/objects';
import { useCurrentUserStore } from '@/stores/current-user';
import { useUIStore } from '@/stores/ui';

/**
 * A visual line marking where the form's content would be cut off by the
 * viewport if the user stopped scrolling right now (spec: "make it clear
 * when editing what would be above / below the fold"). It measures the
 * scroll container once content settles and re-measures on resize, so it
 * tracks both window size and density changes (denser layouts push the fold
 * further down, showing more fields above it).
 */
function FoldIndicator({ wrapperRef }: { wrapperRef: React.RefObject<HTMLDivElement | null> }) {
  const [foldTop, setFoldTop] = useState<number | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    // The scrollable element is Radix's Dialog.Content, an ancestor this component doesn't
    // own a ref to directly — found by data-slot instead of threading a ref through the
    // shadcn wrapper (whose props don't declare `ref`, so it wouldn't forward one anyway).
    const scrollContainer = wrapper.closest<HTMLElement>('[data-slot="dialog-content"]');
    if (!scrollContainer) return;

    const measure = () => {
      if (scrollContainer.scrollHeight <= scrollContainer.clientHeight + 2) {
        setFoldTop(null);
        return;
      }
      // Position relative to `wrapper`'s own box, not the scroll container's — the container's
      // padding means its top edge isn't where `wrapper` (and this absolutely-positioned line)
      // start measuring from. Pulled up a few px past the true clip edge so the line renders
      // inside the visible area instead of sitting exactly on (and easy to miss at) the boundary.
      const containerRect = scrollContainer.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const inset = 16;
      setFoldTop(containerRect.top + scrollContainer.clientHeight - wrapperRect.top - inset);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scrollContainer);
    observer.observe(wrapper);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [wrapperRef]);

  if (foldTop == null) return null;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-2 px-6"
      style={{ top: foldTop }}
      aria-hidden="true"
    >
      <div className="h-px flex-1 border-t-2 border-dashed border-amber-500" />
      <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium tracking-wide text-amber-800 uppercase shadow-sm dark:bg-amber-500/20 dark:text-amber-300">
        fold · scroll for more ↓
      </span>
      <div className="h-0 flex-1 border-t border-dashed border-amber-500/80" />
    </div>
  );
}

type Row = Record<string, unknown>;

export function RecordFormDialog({
  open,
  onOpenChange,
  objectKey,
  mode,
  workspaceId,
  recordId,
  initialValues,
  lockedFields,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  objectKey: ObjectKey;
  mode: 'create' | 'edit';
  workspaceId: string;
  recordId?: string;
  initialValues?: Row;
  /** Fields shown but not editable — e.g. the parent entity when creating a Deal from an Entity page. */
  lockedFields?: string[];
  onSaved?: (row: Row) => void;
}) {
  const object = OBJECTS[objectKey];
  const density = useUIStore((state) => state.density);
  const sectionColumns = useUIStore((state) => state.sectionColumns);
  const currentUser = useCurrentUserStore();
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Every caller mounts this dialog fresh each time it opens (conditional rendering, not a
  // persistent `open` toggle), so a lazy initializer seeds the draft once — no effect needed.
  const [form, setForm] = useState<Row>(() => ({ ...(mode === 'create' ? object.defaults : undefined), ...initialValues }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: unknown) => setForm((current) => ({ ...current, [key]: value }));

  const sections = object.layout.sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter((field) => mode === 'create' ? !field.readOnly : true),
    }))
    .filter((section) => section.fields.length > 0);

  const missingRequired = sections.some((section) =>
    section.fields.some((field) => {
      if (!field.required || lockedFields?.includes(field.key)) return false;
      const value = form[field.key];
      return value == null || value === '';
    }),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== '' && value !== undefined),
      );

      if (mode === 'create') {
        const row = await api.create<Row>(object.resource, {
          workspace_id: workspaceId,
          created_by_user_id: currentUser.userId,
          owner_user_id: currentUser.userId,
          ...payload,
        });
        invalidateList(object.resource, workspaceId);
        onSaved?.(row);
      } else {
        const row = await api.update<Row>(object.resource, recordId!, workspaceId, {
          updated_by_user_id: currentUser.userId,
          ...payload,
        });
        invalidateList(object.resource, workspaceId);
        onSaved?.(row);
      }
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? apiErrorMessage(cause) : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-full"
        style={{ maxWidth: `min(92vw, ${420 + sectionColumns * 140}px)` }}
        data-density={density}
      >
        <div className="relative" ref={wrapperRef}>
          <FoldIndicator wrapperRef={wrapperRef} />
          <form onSubmit={submit} className="flex flex-col" style={{ gap: 'var(--d-gap-section)' }}>
            <DialogHeader>
              <DialogTitle>
                {mode === 'create' ? `New ${object.singular.toLowerCase()}` : `Edit ${object.singular.toLowerCase()}`}
              </DialogTitle>
            </DialogHeader>

            {sections.map((section) => (
              <fieldset key={section.title} className="min-w-0">
                <legend className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase">
                  {section.title}
                </legend>
                <div
                  className="grid"
                  style={{
                    gap: 'var(--d-gap-field)',
                    rowGap: 'var(--d-gap-field)',
                    gridTemplateColumns: `repeat(${sectionColumns}, minmax(160px, 1fr))`,
                  }}
                >
                  {section.fields.map((field) => {
                    const locked = lockedFields?.includes(field.key);
                    return (
                      <div
                        key={field.key}
                        className="space-y-1.5"
                        style={field.type === 'longtext' ? { gridColumn: '1 / -1' } : undefined}
                      >
                        <Label htmlFor={field.key}>
                          {field.label}
                          {field.required ? <span className="text-destructive"> *</span> : null}
                        </Label>
                        {locked ? (
                          <p className="text-muted-foreground py-2 text-sm">
                            {String(form[field.key] ?? '—')}
                          </p>
                        ) : (
                          <FieldInput
                            id={field.key}
                            field={field}
                            value={form[field.key]}
                            onChange={(value) => set(field.key, value)}
                            workspaceId={workspaceId}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </fieldset>
            ))}

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || missingRequired}>
                {saving ? 'Saving…' : mode === 'create' ? `Create ${object.singular.toLowerCase()}` : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function apiErrorMessage(error: ApiError): string {
  if (typeof error.detail === 'string') return error.detail;
  if (Array.isArray(error.detail)) {
    return error.detail
      .map((issue: { path?: unknown[]; message?: string }) => `${issue.path?.join('.') ?? 'field'}: ${issue.message ?? 'invalid'}`)
      .join('; ');
  }
  return error.message;
}
