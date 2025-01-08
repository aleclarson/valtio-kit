import fs from 'node:fs'
import path from 'node:path'
import { proxy } from 'valtio'
import { watch } from 'valtio/utils'
import { createServer } from 'vite'
import reactStatePlugin, { Options } from '../src/index.js'

describe('vite-react-state', () => {
  test('valtio testing', () => {
    const state = proxy({
      nested: { a: 1 },
    })

    watch(get => {
      console.log(get(state).nested.a)
    })

    state.nested.a = 2
  })

  test('arguments', async () => {
    const code = await transform('arguments.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $effect, createState } from '/@fs//path/to/vite-react-state/runtime.js'
      export const Counter = createState(($args) => {
        $effect(() => {
          if ($args[1] === undefined) $args[1] = 1;
          if ($args[2] === undefined) $args[2] = {};
          if ($args[3].e === undefined) $args[3].e = 2;
        });
        return {};
      });
      "
    `)
  })

  test('let variable', async () => {
    const code = await transform('let-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $var, $proxyMap, $proxySet, createState } from '/@fs//path/to/vite-react-state/runtime.js'
      export const Counter = createState(() => {
        let a = $var(0);
        let b = $var({});
        let c = $var([]);
        let d = /* @__PURE__ */ $var($proxyMap());
        let e = /* @__PURE__ */ $var($proxySet());
        let f = $var(() => {
        });
        return {};
      });
      "
    `)
  })

  test('const variable', async () => {
    const code = await transform('const-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $proxy, $proxyMap, $proxySet, createState } from '/@fs//path/to/vite-react-state/runtime.js'
      export const Counter = createState(() => {
        const a = 0;
        const b = $proxy({});
        const c = $proxy([]);
        const d = /* @__PURE__ */ $proxyMap();
        const e = /* @__PURE__ */ $proxySet();
        const f = () => {
        };
        return {};
      });
      "
    `)
  })

  test('watch', async () => {
    const code = await transform('watch.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $var, createState } from '/@fs//path/to/vite-react-state/runtime.js'
      export const Counter = createState(() => {
        let count = $var(0);
        watch(($get) => {
          $get(count).value;
          count.value++;
          count.value = 1;
          let innerVar = 1;
        });
        return {};
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
