import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/**
 * Tests target `src/domain/` — the pure layer. That is deliberate: the domain
 * has no I/O and no framework imports, so it needs no mocks, no test server
 * and no DOM, and the suite runs in well under a second.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
