import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/global-setup.ts'],
    // Integration and e2e tests share one Postgres database and truncate between
    // tests, so they must not run concurrently.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
  // Nest resolves dependencies from decorator metadata, which esbuild does not emit.
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
