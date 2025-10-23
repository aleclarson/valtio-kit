import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/debug.ts', 'src/runtime/index.ts'],
    tsconfig: 'src/runtime/tsconfig.json',
    format: ['esm'],
    dts: true,
  },
  {
    entry: [
      'src/transform/index.ts',
      'src/vite/plugin.ts',
      'src/web-test-runner/plugin.ts',
    ],
    tsconfig: 'src/transform/tsconfig.json',
    format: ['esm'],
    dts: true,
  },
])
