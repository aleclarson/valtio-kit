import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
    runtime: 'src/runtime/index.ts',
  },
  tsconfig: 'src/runtime/tsconfig.json',
  format: ['esm'],
  dts: true,
})
