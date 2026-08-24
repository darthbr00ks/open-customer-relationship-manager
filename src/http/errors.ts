/**
 * Error shape mirroring the previous FastAPI service: `{ "detail": ... }`.
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly detail: unknown,
  ) {
    super(typeof detail === 'string' ? detail : 'Request failed');
    this.name = 'HttpError';
  }
}

export const notFound = (resource: string): HttpError =>
  new HttpError(404, `${resource} not found`);
