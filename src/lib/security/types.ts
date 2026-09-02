/**
 * The contract every permission backend implements.
 *
 * Same shape, and same reasoning, as `src/lib/auth/types.ts` and
 * `src/lib/email/types.ts`. The API asks "may this caller read deals, and which
 * of a deal's fields may they see" and never asks how that was decided — so a
 * deployment that wants LDAP groups, Open Policy Agent, or a permissions
 * service instead of the profile tables writes one file in `./providers` and
 * adds a line to `./registry.ts`.
 *
 * There are two levels, and they compose in one direction only:
 *
 * - **Object level.** May this caller read / create / edit / delete this
 *   resource at all? A `no` here ends the request; field access is not
 *   consulted.
 * - **Field level.** Of the fields on a resource the caller may touch, which
 *   are visible and which are writable? A field is never *more* accessible
 *   than its object.
 */

/** What can be done to a whole object. */
export type ObjectAction = 'read' | 'create' | 'edit' | 'delete';

export const OBJECT_ACTIONS: readonly ObjectAction[] = ['read', 'create', 'edit', 'delete'];

/** What can be done to one field. Ordered least to most permissive. */
export type FieldAccess = 'hidden' | 'read' | 'edit';

export const FIELD_ACCESS_LEVELS: readonly FieldAccess[] = ['hidden', 'read', 'edit'];

/** How a profile's object permissions are carried around. */
export type ObjectGrant = {
  object_key: string;
  can_read: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
};

/** The profile behind a decision, for the UI and for error messages. */
export type PermissionProfile = {
  id: string;
  name: string;
  key: string;
  is_admin: boolean;
};

/**
 * One caller's permissions in one workspace, resolved once and then asked many
 * questions.
 *
 * Resolved per request rather than per check: a list endpoint asks about every
 * field of every row, and going back to the database for each would turn one
 * query into hundreds.
 */
export interface PermissionSet {
  /** Null when nothing is being enforced, or when the caller has no profile. */
  readonly profile: PermissionProfile | null;
  /** False when this set grants everything — the open provider, or an admin. */
  readonly enforces: boolean;

  can(objectKey: string, action: ObjectAction): boolean;
  fieldAccess(objectKey: string, fieldKey: string): FieldAccess;

  /** The subset of `fields` this caller may see. */
  visibleFields(objectKey: string, fields: readonly string[]): string[];
  /** The subset of `fields` this caller may write. */
  writableFields(objectKey: string, fields: readonly string[]): string[];
}

/** Who is asking, and where. */
export type PermissionContext = {
  workspace_id: string;
  /** `app_user.id`, or null when nobody is signed in. */
  user_id: string | null;
};

export interface PermissionProvider {
  /** Stable id, read from `PERMISSIONS_PROVIDER`. */
  readonly id: string;
  readonly label: string;
  /**
   * Whether this provider restricts anything. False for the one that grants
   * everything, and the switch the rest of the app checks before showing a
   * permissions UI or explaining a denial.
   */
  readonly enforces: boolean;
  isConfigured(): boolean;
  permissionsFor(context: PermissionContext): Promise<PermissionSet>;
}

/**
 * A refusal, with enough detail to say *what* was refused.
 *
 * "Forbidden" alone is the least useful error an API returns; an administrator
 * debugging a profile needs to know it was `deals`, `edit`, and which fields.
 */
export class PermissionDeniedError extends Error {
  constructor(
    message: string,
    readonly detail: {
      object_key: string;
      action?: ObjectAction;
      /** Fields the caller may not write, on a rejected write. */
      fields?: string[];
    },
  ) {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}
