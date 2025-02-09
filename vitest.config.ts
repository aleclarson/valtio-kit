import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    isolate: false,
    include: ['test/**/*.test.{ts,tsx}'],
    exclude: ['**/vendor/**', 'node_modules'],
    setupFiles: ['./test/setup.ts'],
    server: {
      deps: {
        external: ['vite'],
      },
    },
  },
})
