import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/debug.ts', 'src/runtime/index.ts'],
    tsconfig: 'src/runtime/tsconfig.json',
    format: ['esm'],
    dts: true,
  },
  {
    entry: ['src/vite/plugin.ts', 'src/transform/index.ts'],
    tsconfig: 'src/transform/tsconfig.json',
    format: ['esm'],
    dts: true,
  },
])
