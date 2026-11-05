import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Request, RequestHandler, Response } from 'express';
import multer from 'multer';
import type { AppConfig } from '../config/env';
import { HttpError } from '../errors';

export type UploadKind = 'products' | 'avatars';

const TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/** Checks the file's first bytes: the MIME type and extension are only what the client claims. */
function hasImageSignature(head: Buffer): boolean {
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp =
    head.subarray(0, 4).toString('latin1') === 'RIFF' &&
    head.subarray(8, 12).toString('latin1') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

export function uploadPath(config: AppConfig, kind: UploadKind, file: string): string {
  return path.join(config.uploadDir, kind, path.basename(file));
}

/** Deletes an uploaded file. Never throws – a missing file is not an error. */
export async function removeUpload(
  config: AppConfig,
  kind: UploadKind,
  file: string | null | undefined,
) {
  if (!file) return;
  await fsp.unlink(uploadPath(config, kind, file)).catch(() => undefined);
}

/**
 * Middleware that accepts one optional image in form field `field` and stores it in
 * `uploads/<kind>/<random>.<ext>`. Image only (JPG/PNG/WebP), real signature, size limited,
 * random server-side file name.
 */
export function imageUpload(
  config: AppConfig,
  kind: UploadKind,
  field: string,
  maxBytes: number,
): RequestHandler[] {
  const dir = path.join(config.uploadDir, kind);
  fs.mkdirSync(dir, { recursive: true });

  const parse = multer({
    storage: multer.diskStorage({
      destination: dir,
      filename: (_req, file, cb) => cb(null, `${randomUUID()}${TYPES[file.mimetype] ?? '.bin'}`),
    }),
    limits: { fileSize: maxBytes, files: 1, fields: 20, parts: 25 },
    fileFilter: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (file.mimetype in TYPES && EXTENSIONS.has(ext)) return cb(null, true);
      cb(HttpError.badRequest('Only JPG, PNG or WebP images are allowed'));
    },
  }).single(field);

  const verify: RequestHandler = async (req, _res, next) => {
    if (!req.file) return next();
    try {
      const handle = await fsp.open(req.file.path, 'r');
      const head = Buffer.alloc(12);
      try {
        await handle.read(head, 0, 12, 0);
      } finally {
        await handle.close();
      }
      if (!hasImageSignature(head)) {
        await discardUpload(req);
        return next(HttpError.badRequest('That file is not a valid image'));
      }
      next();
    } catch (err) {
      next(err);
    }
  };

  return [parse, verify];
}

/** Removes the file multer saved for this request (use when the rest of the request failed). */
export async function discardUpload(req: Request): Promise<void> {
  if (req.file) await fsp.unlink(req.file.path).catch(() => undefined);
}

/** Wraps a handler so an uploaded file is deleted when the handler throws. */
export function withUpload(
  handler: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      await discardUpload(req);
      next(err);
    }
  };
}
