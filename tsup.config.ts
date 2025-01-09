import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    runtime: 'src/runtime/index.ts',
    hooks: 'src/hooks.ts',
    types: 'src/types.ts',
  },
  tsconfig: 'src/runtime/tsconfig.json',
  format: ['esm'],
  dts: true,
})
