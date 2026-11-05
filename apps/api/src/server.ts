import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app';
import { ConfigError, DEV_JWT_SECRET, loadConfig } from './config/env';
import { connectDb, disconnectDb } from './db';
import { createLogger } from './logger';

/** Loads `.env` from the current folder or the repository root (Node's built-in loader). */
function loadDotEnv() {
  for (const dir of [process.cwd(), path.resolve(process.cwd(), '../..')]) {
    const file = path.join(dir, '.env');
    if (fs.existsSync(file)) {
      process.loadEnvFile(file); // does not override variables that are already set
      return;
    }
  }
}

async function main() {
  loadDotEnv();
  const config = loadConfig();
  const logger = createLogger(config);

  if (config.isProduction && config.jwtSecret === DEV_JWT_SECRET) {
    logger.warn('JWT_SECRET is the built-in development value – set your own before going live');
  }

  await connectDb(config.mongoUri);
  logger.info('connected to MongoDB');

  const app = createApp(config, { logger });
  const server = app.listen(config.port, () => {
    logger.info(`cart2heavy listening on ${config.appUrl} (port ${config.port})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(() => {
      void disconnectDb().finally(() => process.exit(0));
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
