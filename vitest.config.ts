import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Forgewarden gate: the test suite MUST run from a clean clone
// (`npm ci && npm test`). The '@' alias mirrors tsconfig paths.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
