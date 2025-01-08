// @vitest-environment jsdom
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { dedent } from 'radashi'
import spawn from 'tinyspawn'
import { useSnapshot } from 'valtio'
import { ReactiveClass, useInstance } from 'vite-react-state/react'

describe('createState', () => {
  test('basic Counter example', async () => {
    type CounterClass = ReactiveClass<
      (initialCount?: number) => { count: number; increment: () => void }
    >
    type CounterModule = { Counter: CounterClass }

    const { Counter } = await load<CounterModule>(dedent/* ts */ `
      export const Counter = createState((initialCount = 0) => {
        let count = initialCount
        return {
          count,
          increment() {
            count++
          },
        }
      })
    `)

    function App() {
      const counter = useSnapshot(useInstance(Counter, 1))

      return (
        <div>
          <span data-testid="count">{counter.count}</span>
          <button data-testid="increment" onClick={counter.increment}>
            +
          </button>
        </div>
      )
    }

    const app = render(<App />)
    expect(app.getByTestId('count')).toHaveTextContent('1')

    await userEvent.click(app.getByTestId('increment'))
    expect(app.getByTestId('count')).toHaveTextContent('2')
  })

  test('using computed', async () => {
    type StateClass = ReactiveClass<
      () => {
        map: Map<number, string>
        mapSizeIsMultipleOfFour: boolean
        set: (key: number, value: string) => void
      }
    >

    const { State } = await load<{ State: StateClass }>(dedent/* ts */ `
      export const State = createState(() => {
        const map = new Map()
        const mapSizeIsMultipleOfFour = computed(() => {
          return map.size % 4 === 0
        })
        return {
          map,
          mapSizeIsMultipleOfFour,
          set(key: number, value: string) {
            map.set(key, value)
          },
        }
      })
    `)

    function App() {
      const state = useSnapshot(useInstance(State))

      return (
        <div>
          <span data-testid="current">
            {String(state.mapSizeIsMultipleOfFour)}
          </span>
          <button
            data-testid="mutate"
            onClick={() => {
              state.set(state.map.size, 'foo')
            }}>
            +
          </button>
        </div>
      )
    }

    const app = render(<App />)
    expect(app.getByTestId('current')).toHaveTextContent('true')

    for (let i = 0; i < 3; i++) {
      await userEvent.click(app.getByTestId('mutate'))
      expect(app.getByTestId('current')).toHaveTextContent('false')
    }

    await userEvent.click(app.getByTestId('mutate'))
    expect(app.getByTestId('current')).toHaveTextContent('true')
  })
})

async function load<T extends Record<string, any>>(code: string) {
  const root = path.resolve(__dirname, 'fixtures/e2e')

  const testId = `test.${md5Hex(code)}`
  const entryId = path.resolve(root, `src/${testId}.state.ts`)
  fs.writeFileSync(entryId, code)

  const configFile = path.resolve(root, 'vite.config.ts')
  fs.writeFileSync(
    configFile,
    dedent/* ts */ `
      import { defineConfig } from 'vite'
      import reactStatePlugin from 'vite-react-state'

      export default defineConfig({
        root: new URL('.', import.meta.url).pathname,
        build: {
          lib: {
            fileName: '${testId}',
            entry: new URL('./src/${testId}.state.ts', import.meta.url).pathname,
            formats: ['es'],
          },
          rollupOptions: {
            external: ['vite-react-state/runtime'],
          },
          minify: false,
          emptyOutDir: false,
        },
        plugins: [
          reactStatePlugin({
            runtimePath: 'vite-react-state/runtime',
          }),
        ],
      })
    `
  )

  const result = await spawn(`pnpm vite build -c ${configFile}`, {
    cwd: root,
  }).catch(e => e)

  // console.log(result.stdout)

  if (result.exitCode) {
    throw new Error(result.stderr)
  }

  const mod = await import(path.resolve(root, `dist/${testId}.js`))
  return mod as T
}

function md5Hex(str: string) {
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 10)
}
