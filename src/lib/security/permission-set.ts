import { ALWAYS_VISIBLE_FIELDS } from './catalog';
import type {
  FieldAccess,
  ObjectAction,
  ObjectGrant,
  PermissionProfile,
  PermissionSet,
} from './types';

/**
 * The two `PermissionSet` implementations, kept together because they are two
 * answers to the same question and reading them side by side is the clearest
 * statement of what enforcement actually changes.
 */

/** Grants everything and knows nothing. What runs when no security is configured. */
export class OpenPermissionSet implements PermissionSet {
  readonly profile: PermissionProfile | null;
  readonly enforces = false;

  constructor(profile: PermissionProfile | null = null) {
    this.profile = profile;
  }

  can(): boolean {
    return true;
  }

  fieldAccess(): FieldAccess {
    return 'edit';
  }

  visibleFields(_objectKey: string, fields: readonly string[]): string[] {
    return [...fields];
  }

  writableFields(_objectKey: string, fields: readonly string[]): string[] {
    return [...fields];
  }
}

/**
 * A profile's grants, resolved into something cheap to ask.
 *
 * Two maps, both built once per request: object key → CRUD flags, and
 * `object:field` → access. A list of 200 rows asks `fieldAccess` thousands of
 * times, so every lookup here has to be a hash lookup rather than a scan.
 *
 * The rules it encodes:
 *
 * - **Objects are deny-by-default.** No row means no access. Permission is
 *   granted deliberately, never inherited from silence.
 * - **Fields are inherit-by-default.** No row means the field is as accessible
 *   as its object. Only restrictions are stored, so the table stays
 *   proportional to what an administrator actually did.
 * - **A field is never more accessible than its object.** `edit` on a field of
 *   a read-only object still reads as `read`.
 */
export class ProfilePermissionSet implements PermissionSet {
  readonly enforces = true;

  private readonly objects: Map<string, ObjectGrant>;
  private readonly fields: Map<string, FieldAccess>;

  constructor(
    readonly profile: PermissionProfile,
    grants: readonly ObjectGrant[],
    fieldGrants: readonly { object_key: string; field_key: string; access: FieldAccess }[],
  ) {
    this.objects = new Map(grants.map((grant) => [grant.object_key, grant]));
    this.fields = new Map(
      fieldGrants.map((grant) => [`${grant.object_key}:${grant.field_key}`, grant.access]),
    );
  }

  can(objectKey: string, action: ObjectAction): boolean {
    const grant = this.objects.get(objectKey);
    if (!grant) return false;

    switch (action) {
      case 'read':
        return grant.can_read;
      case 'create':
        return grant.can_create;
      case 'edit':
        return grant.can_edit;
      case 'delete':
        return grant.can_delete;
    }
  }

  fieldAccess(objectKey: string, fieldKey: string): FieldAccess {
    // The object gates the field, so work out the ceiling first.
    const ceiling: FieldAccess = this.can(objectKey, 'edit')
      ? 'edit'
      : this.can(objectKey, 'read')
        ? 'read'
        : 'hidden';

    if (ALWAYS_VISIBLE_FIELDS.includes(fieldKey)) {
      // Identifiers survive as long as the object is readable at all: without
      // them a permitted response could not be addressed or written back.
      return ceiling === 'hidden' ? 'hidden' : 'read';
    }

    const explicit = this.fields.get(`${objectKey}:${fieldKey}`);
    if (!explicit) return ceiling;

    // The more restrictive of the two always wins.
    if (ceiling === 'hidden' || explicit === 'hidden') return 'hidden';
    if (ceiling === 'read' || explicit === 'read') return 'read';
    return 'edit';
  }

  visibleFields(objectKey: string, fields: readonly string[]): string[] {
    return fields.filter((field) => this.fieldAccess(objectKey, field) !== 'hidden');
  }

  writableFields(objectKey: string, fields: readonly string[]): string[] {
    return fields.filter((field) => this.fieldAccess(objectKey, field) === 'edit');
  }
}

/**
 * An administrator.
 *
 * Distinct from `OpenPermissionSet` only in carrying the profile that granted
 * it, which is what lets the UI say "you are seeing everything because you are
 * an Administrator" rather than leaving someone to wonder whether security is
 * switched on at all.
 */
export class AdminPermissionSet extends OpenPermissionSet {
  constructor(profile: PermissionProfile) {
    super(profile);
  }
}

/** Denies everything. A signed-in user with no profile and no default to fall back on. */
export class NoPermissionSet implements PermissionSet {
  readonly profile = null;
  readonly enforces = true;

  can(): boolean {
    return false;
  }

  fieldAccess(): FieldAccess {
    return 'hidden';
  }

  visibleFields(): string[] {
    return [];
  }

  writableFields(): string[] {
    return [];
  }
}
