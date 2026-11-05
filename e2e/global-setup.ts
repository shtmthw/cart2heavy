import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { appPort, mailPort, usesExistingStack } from './stack';

const root = path.resolve(import.meta.dirname, '..');
const project = 'c2h-e2e';

function compose(...args: string[]) {
  execFileSync('docker', ['compose', '-p', project, ...args], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      APP_PORT: appPort,
      MAILPIT_PORT: mailPort,
      SEED_ON_START: 'true',
      PAYMENT_PROVIDER: 'mock',
      STRIPE_SECRET_KEY: '',
    },
  });
}

/**
 * Starts a throw-away copy of the whole shop (built from this checkout) and removes it, with its
 * data, afterwards. Skipped when E2E_BASE_URL points at a stack that is already running.
 */
export default function globalSetup() {
  if (usesExistingStack) return;
  compose('down', '--volumes', '--remove-orphans'); // a clean start, even after a crashed run
  compose('up', '--build', '--detach', '--wait', '--wait-timeout', '240');

  return () => {
    if (process.env.E2E_KEEP_STACK) return;
    compose('down', '--volumes', '--remove-orphans');
  };
}
