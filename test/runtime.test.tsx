// @vitest-environment jsdom
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { dedent } from 'radashi'
import spawn from 'tinyspawn'
import { EventTarget, ReactiveClass } from 'valtio-kit'
import { useInstance, useSnapshot } from 'valtio-kit/react'

describe('createClass', () => {
  test('basic Counter example', async () => {
    type CounterClass = ReactiveClass<
      (initialCount?: number) => { count: number; increment: () => void }
    >
    type CounterModule = { Counter: CounterClass }

    const { Counter } = await load<CounterModule>(dedent/* ts */ `
      import { createClass } from 'valtio-kit'

      export const Counter = createClass((initialCount = 0) => {
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
        foo: { bar: string | undefined }
        map: Map<number, string>
        mapSizeIsMultipleOfFour: boolean
        set: (key: number, value: string) => void
      }
    >

    const { State } = await load<{ State: StateClass }>(dedent/* ts */ `
      import { createClass } from 'valtio-kit'

      export const State = createClass(() => {
        const map = new Map()
        const mapSizeIsMultipleOfFour = computed(() => {
          return map.size % 4 === 0
        })
        const foo = {
          bar: computed(() => map.get(0)),
        }
        return {
          foo,
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
          <span data-testid="foo-bar">{state.foo.bar}</span>
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
    expect(app.getByTestId('foo-bar')).toHaveTextContent('')
    expect(app.getByTestId('current')).toHaveTextContent('true')

    await userEvent.click(app.getByTestId('mutate'))
    expect(app.getByTestId('foo-bar')).toHaveTextContent('foo')
    expect(app.getByTestId('current')).toHaveTextContent('false')

    for (let i = 0; i < 2; i++) {
      await userEvent.click(app.getByTestId('mutate'))
      expect(app.getByTestId('current')).toHaveTextContent('false')
    }

    await userEvent.click(app.getByTestId('mutate'))
    expect(app.getByTestId('current')).toHaveTextContent('true')
  })

  test('useInstance creates new instance when class argument changes', async () => {
    type CounterClass = ReactiveClass<
      (initialCount?: number) => { count: number; increment: () => void }
    >
    type CounterModule = {
      Counter: CounterClass
      CounterBy2: CounterClass
    }

    const { Counter, CounterBy2 } = await load<CounterModule>(dedent/* ts */ `
      import { createClass } from 'valtio-kit'

      export const Counter = createClass((initialCount = 0) => {
        let count = initialCount
        return {
          count,
          increment() {
            count++
          },
        }
      })

      export const CounterBy2 = createClass((initialCount = 0) => {
        let count = initialCount
        return {
          count,
          increment() {
            count += 2
          },
        }
      })
    `)

    function App({ Counter }: { Counter: CounterClass }) {
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

    const app = render(<App Counter={Counter} />)
    expect(app.getByTestId('count')).toHaveTextContent('1')

    await userEvent.click(app.getByTestId('increment'))
    expect(app.getByTestId('count')).toHaveTextContent('2')

    app.rerender(<App Counter={CounterBy2} />)
    expect(app.getByTestId('count')).toHaveTextContent('1')

    await userEvent.click(app.getByTestId('increment'))
    expect(app.getByTestId('count')).toHaveTextContent('3')
  })

  test('reactive instance composition', async () => {
    type Module = {
      Outer: ReactiveClass<
        () => {
          inner: {
            value: number
            increment: () => void
            get isMounted(): boolean
          }
          data: string
        }
      >
    }

    const { Outer } = await load<Module>(dedent/* ts */ `
      import { createClass, proxy } from 'valtio-kit'

      const Inner = createClass(() => {
        let value = 1
        let mounted = false
        onMount(() => {
          mounted = true
          return () => {
            mounted = false
          }
        })
        return {
          value,
          increment() {
            value++
          },
          get isMounted() {
            return mounted
          },
        }
      })

      export const Outer = createClass(() => {
        const inner = proxy(new Inner())
        const data = computed(() => {
          return 'hello ' + inner.value
        })
        return { inner, data }
      })
    `)

    const outer = new Outer()
    try {
      expect(outer.inner.value).toBe(1)
      expect(outer.data).toBe('hello 1')

      outer.inner.increment()
      expect(outer.data).toBe('hello 2')
    } finally {
      outer.release()
    }
    expect(outer.inner.isMounted).toBe(false)
  })

  test('createEventTarget', async () => {
    type Module = {
      Foo: ReactiveClass<
        () => EventTarget<{
          foo: [value: number]
        }> & {
          foo: number
          setFoo: (value: number) => void
        }
      >
    }

    const { Foo } = await load<Module>(dedent/* ts */ `
      import { createEventTarget, createClass } from 'valtio-kit'

      export const Foo = createClass(() => {
        let foo = 0

        const [eventsMixin, emit] = createEventTarget<{
          foo: [value: number]
        }>()

        subscribe(foo, () => {
          emit('foo', foo)
        })

        return {
          ...eventsMixin,
          foo,
          setFoo(newFoo) {
            foo = newFoo
          },
        }
      })
    `)

    const foo = new Foo()
    try {
      const listener = vi.fn()

      // Add listener.
      foo.addEventListener('foo', listener)
      foo.setFoo(1)
      await Promise.resolve()
      expect(listener).toHaveBeenCalledWith(1)
      foo.setFoo(2)
      await Promise.resolve()
      expect(listener).toHaveBeenCalledWith(2)

      // Remove listener.
      foo.removeEventListener('foo', listener)
      foo.setFoo(3)
      await Promise.resolve()
      expect(listener).not.toHaveBeenCalledWith(3)

      listener.mockReset()

      // One-time listener.
      foo.addEventListener('foo', listener, { once: true })
      foo.setFoo(4)
      await Promise.resolve()
      expect(listener).toHaveBeenCalledWith(4)
      foo.setFoo(5)
      await Promise.resolve()
      expect(listener).not.toHaveBeenCalledWith(5)

      // Abort signal.
      const abortController = new AbortController()
      foo.addEventListener('foo', listener, { signal: abortController.signal })
      abortController.abort()
      foo.setFoo(6)
      await Promise.resolve()
      expect(listener).not.toHaveBeenCalledWith(6)
    } finally {
      foo.release()
    }
  })
})

async function load<T extends Record<string, any>>(code: string) {
  const root = path.resolve(__dirname, 'fixtures/e2e')

  const testId = `test.${md5Hex(code)}`
  const entryId = path.resolve(root, `src/${testId}.state.ts`)
  fs.mkdirSync(path.dirname(entryId), { recursive: true })
  fs.writeFileSync(entryId, code)

  const configFile = path.resolve(root, 'vite.config.ts')
  fs.writeFileSync(
    configFile,
    dedent/* ts */ `
      import { defineConfig } from 'vite'
      import { valtioKit } from 'valtio-kit/vite'

      export default defineConfig({
        root: new URL('.', import.meta.url).pathname,
        build: {
          lib: {
            fileName: '${testId}',
            entry: new URL('./src/${testId}.state.ts', import.meta.url).pathname,
            formats: ['es'],
          },
          rollupOptions: {
            external: ['valtio-kit', 'valtio-kit/runtime'],
          },
          minify: false,
          emptyOutDir: false,
        },
        plugins: [
          valtioKit({
            globals: true,
            runtimePath: 'valtio-kit/runtime',
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
