// @vitest-environment jsdom
import { fireEvent, render } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { dedent } from 'radashi'
import spawn from 'tinyspawn'
import { useSnapshot } from 'valtio'
import { ReactiveClass, useInstance } from 'vite-react-state/react'

describe('createState', () => {
  test('basic flow', async () => {
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
            console.log('increment')
            count++
          },
        }
      })
    `)

    function App() {
      const counter = useSnapshot(useInstance(Counter, 1))
      console.log('render')

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

    fireEvent.click(app.getByTestId('increment'))
    expect(app.getByTestId('count')).toHaveTextContent('2')
  })
})

async function load<T extends Record<string, any>>(code: string) {
  const root = path.resolve(__dirname, 'fixtures/e2e')

  const entryId = path.resolve(root, 'src/test.state.ts')
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
            fileName: 'test',
            entry: new URL('./src/test.state.ts', import.meta.url).pathname,
            formats: ['es'],
          },
          rollupOptions: {
            external: ['vite-react-state/runtime'],
          },
          minify: false,
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

  console.log(result.stdout)

  if (result.exitCode) {
    throw new Error(result.stderr)
  }

  const mod = await import(path.resolve(root, 'dist/test.js'))
  return mod as T
}
