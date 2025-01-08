import { createServer } from 'vite'
import reactStatePlugin from '../src/index.js'

async function load(code: string) {
  const server = await createServer({
    root: __dirname,
    logLevel: 'silent',
    plugins: [
      {
        name: 'loader',
        load(id) {
          if (id === '\0test.state.ts') return { code }
        },
      },
      reactStatePlugin(),
    ],
  })

  const module = await server.ssrLoadModule('\0test.state.ts')
  return module
}
