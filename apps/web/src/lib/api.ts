import type { ApiErrorBody, ErrorCode } from '@cart2heavy/shared';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | 'network_error',
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | null | undefined;
interface RequestOptions {
  query?: Record<string, QueryValue>;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `/api${path}${qs ? `?${qs}` : ''}`;
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: BodyInit | undefined;
  if (options.form) {
    body = options.form; // the browser sets the multipart boundary itself
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: 'same-origin', // the session lives in an httpOnly cookie
      signal: options.signal ?? null,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'network_error',
      'Cannot reach the server. Check your connection and try again.',
    );
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const error = (data as ApiErrorBody | undefined)?.error;
    throw new ApiError(
      response.status,
      error?.code ?? 'internal_error',
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Record<string, QueryValue>, signal?: AbortSignal) =>
    request<T>('GET', path, { ...(query ? { query } : {}), ...(signal ? { signal } : {}) }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
  /** multipart/form-data (file uploads) */
  upload: <T>(method: 'POST' | 'PATCH', path: string, form: FormData) =>
    request<T>(method, path, { form }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong';
}
