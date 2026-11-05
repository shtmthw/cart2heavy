import { parseArgs } from 'node:util';
import { ZodError } from 'zod';
import { ROLES, type Role } from '@cart2heavy/shared';
import { loadDotEnv } from '../config/dotenv';
import { ConfigError, loadConfig } from '../config/env';
import { connectDb, disconnectDb } from '../db';
import { HttpError } from '../errors';
import { createAccount } from './accounts';

const USAGE = `Create an account (admin, logistics or customer).

  pnpm create-user --role admin --email you@example.com --name "Your Name" [--password ...]
  docker compose exec app node dist/create-user.js --role admin --email you@example.com --name "Your Name"

Without --password a random one is generated and printed once.`;

async function main() {
  const { values } = parseArgs({
    options: {
      role: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      password: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || !values.role || !values.email || !values.name) {
    console.log(USAGE);
    process.exit(values.help ? 0 : 1);
  }
  if (!ROLES.includes(values.role as Role)) {
    console.error(`--role must be one of: ${ROLES.join(', ')}`);
    process.exit(1);
  }

  loadDotEnv();
  const config = loadConfig();
  await connectDb(config.mongoUri);
  try {
    const { user, password } = await createAccount(config, {
      role: values.role as Role,
      email: values.email,
      name: values.name,
      password: values.password,
    });
    console.log(`Created ${user.role} account ${user.email}`);
    if (!values.password) console.log(`Password (shown only now): ${password}`);
  } finally {
    await disconnectDb();
  }
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) console.error(err.message);
  else if (err instanceof ZodError)
    console.error(err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n'));
  else if (err instanceof HttpError) console.error(err.message);
  else console.error(err);
  process.exit(1);
});
