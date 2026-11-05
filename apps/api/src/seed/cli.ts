import { loadDotEnv } from '../config/dotenv';
import { ConfigError, loadConfig } from '../config/env';
import { connectDb, disconnectDb } from '../db';
import { createLogger } from '../logger';
import { DEMO_PASSWORDS, OWNER_ACCOUNT } from './data';
import { seedDatabase } from './seed';

/** `pnpm seed` fills an empty database; `pnpm seed -- --reset` wipes it first. */
async function main() {
  loadDotEnv();
  const config = loadConfig();
  const logger = createLogger({ env: config.env, logLevel: 'info' });
  const reset = process.argv.includes('--reset');

  await connectDb(config.mongoUri);
  try {
    const seeded = await seedDatabase({ config, logger }, { reset });
    if (!seeded) {
      console.log(
        'The database already has data – nothing was changed. Use --reset to wipe and re-seed.',
      );
      return;
    }
    console.log('\nDemo accounts:');
    for (const account of [...Object.values(DEMO_PASSWORDS), OWNER_ACCOUNT]) {
      console.log(`  ${account.email.padEnd(28)} ${account.password}`);
    }
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof ConfigError ? err.message : err);
  process.exit(1);
});
