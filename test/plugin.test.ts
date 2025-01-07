import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'
import reactStatePlugin, { Options } from '../src/index.js'

describe('vite-react-state', () => {
  test('let variable', async () => {
    const code = await transform('let-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $shallowRef, createState } from '/@fs//path/to/vite-react-state/runtime.js'
      export const useThing = createState(($args) => {
        let count = $shallowRef(0);
        return {
          count
        };
      });
      "
    `)
  })
})

async function transform(fixtureId: string, options: Options = {}) {
  const root = path.join(__dirname, 'fixtures')
  const fixturePath = path.join(root, fixtureId)

  let result = fs.readFileSync(fixturePath, 'utf-8')

  const server = await createServer({
    root,
    logLevel: 'silent',
    plugins: [
      reactStatePlugin({
        include: /\.[jt]s$/,
        onTransform(code) {
          result = code
        },
      }),
    ],
    environments: {
      client: {
        dev: {
          moduleRunnerTransform: false,
        },
      },
    },
  })

  await server.transformRequest('/@fs/' + fixturePath, {
    ssr: false,
  })

  return result
}
