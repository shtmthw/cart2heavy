import fs from 'node:fs';
import path from 'node:path';

/** Loads `.env` from the current folder or the repository root (Node's built-in loader). */
export function loadDotEnv(): void {
  for (const dir of [process.cwd(), path.resolve(process.cwd(), '../..')]) {
    const file = path.join(dir, '.env');
    if (fs.existsSync(file)) {
      process.loadEnvFile(file); // does not override variables that are already set
      return;
    }
  }
}
