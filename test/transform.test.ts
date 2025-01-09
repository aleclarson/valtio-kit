import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'
import { Options, valtioKit } from '../src/vite/plugin.js'

describe('valtio-kit', () => {
  test('let variable', async () => {
    const code = await transform('let-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "export const Counter = createClass(() => {
        let a = 0
        let b = {}
        let c = []
        let d = new Map()
        let e = new Set()
        let f = () => {}

        return {}
      })
      "
    `)
  })

  test('const variable', async () => {
    const code = await transform('const-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "export const Counter = createClass(() => {
        const a = 0
        const b = {}
        const c = []
        const d = new Map()
        const e = new Set()
        const f = () => {}

        return {}
      })
      "
    `)
  })

  test('return', async () => {
    const code = await transform('return.ts')
    expect(code).toMatchInlineSnapshot(`
      "export const Counter = createClass(() => {
        let a = 0
        const b = { a }

        return {
          a,
          b,
          c: {
            a,
            b,
            get d() {
              return 1
            },
            array: [a, b],
          },
          get d() {
            return 2
          },
          array: [a, b],
          staticObject: { a: 1 },
        }
      })
      "
    `)
  })

  test('subscribe', async () => {
    const code = await transform('subscribe.ts')
    expect(code).toMatchInlineSnapshot(`
      "export const Counter = createClass(() => {
        let a = 0
        const b = { c: 1 }

        subscribe(a, () => {
          console.log('a changed to', a)
        })

        subscribe(b, () => {
          console.log('b changed to', b)
        })

        return {}
      })
      "
    `)
  })

  test('watch', async () => {
    const code = await transform('watch.ts')
    expect(code).toMatchInlineSnapshot(`
      "export const Counter = createClass(() => {
        let a = 0
        const b = { c: { d: 1 } }
        let array = []
        let map = new Map()

        watch(() => {
          a // primitive reference
          a++ // update expression
          a = 1 // assignment expression

          b.c.d // property access
          b.c.d = 2 // assignment expression

          array = [2] // set array variable
          map = new Map() // set Map variable

          // should not be transformed
          let innerVar = 1
        })

        return {}
      })
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
    configFile: false,
    plugins: [
      valtioKit({
        ...options,
        globals: true,
        include: /\.[jt]s$/,
        runtimePath: '/path/to/valtio-kit/runtime.js',
        onTransform(code) {
          result = code
        },
      }),
    ],
  })

  await server.transformRequest('/@fs/' + fixturePath, {
    ssr: false,
  })

  return result
}
