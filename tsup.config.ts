import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/runtime.ts', 'src/reactivity.ts'],
  format: ['esm'],
  dts: true,
})
