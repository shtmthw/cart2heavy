import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Error as MongooseError, mongo } from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import type { ApiErrorBody, ErrorCode } from '@cart2heavy/shared';
import { HttpError } from '../errors';
import type { Logger } from '../logger';

export function send(
  res: Parameters<RequestHandler>[1],
  status: number,
  code: ErrorCode,
  message: string,
  details?: Record<string, string[]>,
) {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } };
  res.status(status).json(body);
}

export const notFound: RequestHandler = (_req, res) => {
  send(res, 404, 'not_found', 'Not found');
};

function zodDetails(error: z.ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

function hasStringProp(value: unknown, key: string): value is Record<string, string> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as Record<string, unknown>)[key] === 'string'
  );
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof HttpError) {
      return send(res, err.status, err.code, err.message, err.details);
    }
    if (err instanceof z.ZodError) {
      const details = zodDetails(err);
      return send(res, 400, 'validation_error', err.issues[0]?.message ?? 'Invalid input', details);
    }
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return send(res, 413, 'payload_too_large', 'That file is too large (5 MB maximum)');
      }
      return send(res, 400, 'bad_request', 'The upload could not be processed');
    }
    if (err instanceof mongo.MongoServerError && err.code === 11000) {
      return send(res, 409, 'conflict', 'That already exists');
    }
    if (err instanceof MongooseError.ValidationError) {
      return send(res, 400, 'validation_error', err.message);
    }
    if (hasStringProp(err, 'type')) {
      // body-parser errors
      if (err.type === 'entity.too.large') {
        return send(res, 413, 'payload_too_large', 'The request is too large');
      }
      if (err.type === 'entity.parse.failed' || err.type === 'encoding.unsupported') {
        return send(res, 400, 'bad_request', 'The request body is not valid JSON');
      }
    }

    logger.error({ err, method: req.method, url: req.originalUrl }, 'unhandled error');
    send(res, 500, 'internal_error', 'Something went wrong on our side');
  };
}
