/** Thin fetch wrapper over the REST API, surfacing `{ detail }` errors. */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: unknown,
  ) {
    super(typeof detail === 'string' ? detail : `Request failed with ${status}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(response.status, body?.detail ?? response.statusText);
  }
  return body as T;
}

const query = (params: Record<string, string | number | boolean | undefined>) =>
  new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => [key, String(value)]),
  ).toString();

export const api = {
  list<T>(resource: string, params: Record<string, string | number | boolean | undefined>) {
    return request<T[]>(`/api/v1/${resource}?${query(params)}`);
  },
  get<T>(resource: string, id: string, workspaceId: string) {
    return request<T>(`/api/v1/${resource}/${id}?${query({ workspace_id: workspaceId })}`);
  },
  create<T>(resource: string, body: Record<string, unknown>) {
    return request<T>(`/api/v1/${resource}`, { method: 'POST', body: JSON.stringify(body) });
  },
  update<T>(resource: string, id: string, workspaceId: string, body: Record<string, unknown>) {
    return request<T>(`/api/v1/${resource}/${id}?${query({ workspace_id: workspaceId })}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  /**
   * POST to a record sub-action, e.g. `chat-conversations/{id}/read` or
   * `quotes/{id}/accept`. Some actions take a body; most do not.
   */
  action<T>(resource: string, id: string, name: string, workspaceId: string, body?: Record<string, unknown>) {
    return request<T>(`/api/v1/${resource}/${id}/${name}?${query({ workspace_id: workspaceId })}`, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  archive<T>(resource: string, id: string, workspaceId: string) {
    return request<T>(
      `/api/v1/${resource}/${id}/archive?${query({ workspace_id: workspaceId })}`,
      { method: 'POST' },
    );
  },
  reportPipeline(workspaceId: string) {
    return request<unknown>(`/api/v1/reports/pipeline?${query({ workspace_id: workspaceId })}`);
  },
};
