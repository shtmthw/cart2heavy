import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    server: 'src/server.ts',
    seed: 'src/seed/cli.ts',
    'create-user': 'src/seed/create-user.ts',
  },
  format: ['esm'],
  target: 'node24',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // The shared package is TypeScript source inside the workspace – bundle it into the output,
  // so the runtime image does not need the workspace packages, only the API's own dependencies.
  noExternal: ['@cart2heavy/shared'],
});
