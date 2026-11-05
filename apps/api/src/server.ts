import { createApp } from './app';
import { loadDotEnv } from './config/dotenv';
import { ConfigError, loadConfig } from './config/env';
import { ensureJwtSecret } from './config/secret';
import { connectDb, disconnectDb } from './db';
import { createLogger } from './logger';
import { seedDatabase } from './seed/seed';

async function main() {
  loadDotEnv();
  const loaded = loadConfig();
  const logger = createLogger(loaded);

  await connectDb(loaded.mongoUri);
  logger.info('connected to MongoDB');
  const config = await ensureJwtSecret(loaded);

  if (config.seedOnStart && (await seedDatabase({ config, logger }))) {
    logger.info('the database was empty, demo data was added (SEED_ON_START=true)');
  }

  if (config.payment.provider === 'mock' && config.isProduction) {
    logger.warn(
      'PAYMENT_PROVIDER=mock: payments are simulated. Set STRIPE_SECRET_KEY to take real payments.',
    );
  }

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
