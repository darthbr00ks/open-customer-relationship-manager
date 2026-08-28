import { z } from 'zod';

/** Building blocks shared by every resource's create/update schemas. */

export const uuid = () => z.uuid();

/** timestamptz column: accepts an ISO-8601 string, stores a Date. */
export const ts = () => z.coerce.date();

/**
 * date column. Accepts `YYYY-MM-DD` (or any ISO date) and yields a Date, which
 * is what Prisma expects for a `@db.Date` field; responses render it back to
 * `YYYY-MM-DD`.
 */
export const day = () => z.union([z.iso.date(), z.iso.datetime()]).pipe(z.coerce.date());

/**
 * numeric column. Money and quantities are carried as strings end to end so
 * nothing is ever rounded through a float; a number is accepted for
 * convenience and stringified immediately.
 */
export const decimal = () =>
  z
    .union([z.string(), z.number()])
    .transform(String)
    .refine((value) => /^-?\d+(\.\d+)?$/.test(value), { message: 'Expected a decimal number' });

/** Scoping and audit fields accepted when creating any primary RM object. */
export const sharedCreate = {
  workspace_id: uuid(),
  owner_user_id: uuid().nullish(),
  created_by_user_id: uuid().nullish(),
  updated_by_user_id: uuid().nullish(),
  archived_at: ts().nullish(),
};

/** Audit fields a client may reassign on update. */
export const sharedUpdate = {
  owner_user_id: uuid().nullish(),
  updated_by_user_id: uuid().nullish(),
};
