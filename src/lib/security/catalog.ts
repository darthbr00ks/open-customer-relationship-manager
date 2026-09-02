import { resources, type ResourceName } from '@/lib/api/resources';

/**
 * What there is to permission: every object, and every field on it.
 *
 * Derived from the Zod schemas already registered in `src/lib/api/resources.ts`
 * rather than written out again here. A second hand-maintained list would drift
 * the first time somebody added a column, and the failure mode of *that* is a
 * field nobody can restrict because the permission screen has never heard of
 * it.
 */

/**
 * Fields no profile may hide.
 *
 * `id` and `workspace_id` are not data about the record, they are how a client
 * addresses it — masking them would break every response rather than protect
 * anything.
 */
export const ALWAYS_VISIBLE_FIELDS: readonly string[] = ['id', 'workspace_id'];

/**
 * Columns present in every response but in no create schema, so they have to be
 * named to be permissionable at all.
 */
const SYSTEM_FIELDS: readonly string[] = ['created_at', 'updated_at'];

/** A Zod object's keys, or null for a schema that is not a plain object. */
function shapeKeys(schema: unknown): string[] | null {
  const shape = (schema as { shape?: Record<string, unknown> })?.shape;
  return shape ? Object.keys(shape) : null;
}

const catalogCache = new Map<string, string[]>();

/**
 * Every field key an object can carry, in a stable order.
 *
 * The union of the create and update schemas: a few fields are settable only on
 * one or the other, and both appear in responses.
 */
export function fieldsOf(objectKey: string): string[] {
  const cached = catalogCache.get(objectKey);
  if (cached) return cached;

  const config = resources[objectKey as ResourceName];
  if (!config) return [];

  const keys = new Set<string>([
    ...(shapeKeys(config.createSchema) ?? []),
    ...(shapeKeys(config.updateSchema) ?? []),
    ...SYSTEM_FIELDS,
  ]);
  for (const always of ALWAYS_VISIBLE_FIELDS) keys.delete(always);

  const fields = [...keys];
  catalogCache.set(objectKey, fields);
  return fields;
}

/** Whether an object key names a resource this app actually has. */
export const isKnownObject = (objectKey: string): boolean => objectKey in resources;

/** Whether a field key exists on an object — so a permission row cannot name a typo. */
export const isKnownField = (objectKey: string, fieldKey: string): boolean =>
  ALWAYS_VISIBLE_FIELDS.includes(fieldKey) || fieldsOf(objectKey).includes(fieldKey);

export const OBJECT_KEYS: string[] = Object.keys(resources);

/**
 * The whole catalog, for the profile editor to render.
 *
 * `label` is the resource name humanised — good enough for a settings screen,
 * and it costs nothing to keep in step with a new resource.
 */
export function permissionCatalog(): { object_key: string; label: string; fields: string[] }[] {
  return OBJECT_KEYS.map((object_key) => ({
    object_key,
    label: resources[object_key as ResourceName].label,
    fields: fieldsOf(object_key),
  }));
}
