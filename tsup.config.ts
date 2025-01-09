import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/react/index.ts',
    'src/vite/plugin.ts',
    'src/transform/index.ts',
  ],
  tsconfig: 'src/runtime/tsconfig.json',
  format: ['esm'],
  dts: true,
})
