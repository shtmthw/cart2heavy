import type { ErrorCode } from '@cart2heavy/shared';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: Record<string, string[]>) {
    return new HttpError(400, 'bad_request', message, details);
  }
  static unauthorized(message = 'Please log in to continue') {
    return new HttpError(401, 'unauthorized', message);
  }
  static forbidden(message = 'You are not allowed to do that') {
    return new HttpError(403, 'forbidden', message);
  }
  static notFound(what = 'Resource') {
    return new HttpError(404, 'not_found', `${what} not found`);
  }
  static conflict(message: string) {
    return new HttpError(409, 'conflict', message);
  }
}
