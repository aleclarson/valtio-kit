import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'
import { Options, valtioKit } from '../src/vite/plugin.js'

describe('valtio-kit', () => {
  test('let variable', async () => {
    const code = await transform('let-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $proxyMap, $proxySet, $atom, $proxy, createClass } from '/@fs//path/to/valtio-kit/runtime.js'
      export const Counter = createClass(() => {
        let a = $atom(0);
        let b = $atom({
          c: 0,
          d: 0,
          // Nested objects/arrays are not wrapped with $proxy, but they will still be
          // deeply reactive.
          nestedObject: {},
          nestedArray: []
        });
        let c = $atom([]);
        let d = /* @__PURE__ */ $atom($proxyMap());
        let e = /* @__PURE__ */ $atom($proxySet());
        let f = () => {
          a.value++;
          b.value = { c: 1, d: 1, nestedObject: {}, nestedArray: [] };
          b.value.c++;
          b.value.d = 1;
          b.value.d;
          c.value = [1];
          c.value.push(2);
          d.value = /* @__PURE__ */ $proxyMap();
          d.value.set(1, 1);
          e.value = /* @__PURE__ */ $proxySet();
          e.value.add(1);
          let nestedVar = 0;
          nestedVar++;
        };
        let a2 = 0;
        let b2 = $proxy({});
        let c2 = $proxy([]);
        let d2 = /* @__PURE__ */ $proxyMap();
        let e2 = /* @__PURE__ */ $proxySet();
        return {
          f,
          a2,
          b2,
          c2,
          d2,
          e2
        };
      }, "Counter");
      "
    `)
  })

  test('const variable', async () => {
    const code = await transform('const-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $proxyMap, $proxySet, $proxy, createClass } from '/@fs//path/to/valtio-kit/runtime.js'
      export const Counter = createClass(() => {
        const a = 0;
        const b = $proxy({});
        const c = $proxy([]);
        const d = /* @__PURE__ */ $proxyMap();
        const e = /* @__PURE__ */ $proxySet();
        const f = () => {
          const nestedConst = { a: 1 };
          nestedConst.a++;
        };
        return {};
      }, "Counter");
      "
    `)
  })

  test('destructured variable', async () => {
    const code = await transform('destructured-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $atom, createClass } from '/@fs//path/to/valtio-kit/runtime.js'
      export const Point2D = createClass(({ x, y }, options) => {
        x = $atom(x);
        const { rotation = 0 } = options;
        let { scale = 1, origin = { x: 0, y: 0 } } = options; scale = $atom(scale);
        let [foo, bar] = options.array; foo = $atom(foo);
        return {
          rotation,
          moveX(distance) {
            x.value += distance;
          },
          someCoolMethod() {
            foo.value = 1;
            scale.value = 2;
            origin.x = 3;
          }
        };
      }, "Point2D");
      "
    `)
  })

  test('return', async () => {
    const code = await transform('return.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $atom, $unnest, $proxy, createClass } from '/@fs//path/to/valtio-kit/runtime.js'
      export const Counter = createClass(() => {
        let a = $atom(0);
        const b = $proxy({ a: a.value });
        return {
          a,
          b,
          c: $unnest({
            a,
            b,
            get d() {
              return 1;
            },
            array: [a.value, b]
          }),
          get d() {
            return 2;
          },
          array: [a.value, b],
          staticObject: { a: 1 },
          foo() {
            a.value++;
          }
        };
      }, "Counter");
      "
    `)
  })

  test('subscribe', async () => {
    const code = await transform('subscribe.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { subscribe, $atom, $proxy, createClass } from '/@fs//path/to/valtio-kit/runtime.js'
      export const Counter = createClass(() => {
        let a = $atom(0);
        const b = $proxy({ c: 1 });
        subscribe(a, () => {
          console.log("a changed to", a.value);
        });
        subscribe(b, () => {
          console.log("b changed to", b);
        });
        return {};
      }, "Counter");
      "
    `)
  })

  test('watch', async () => {
    const code = await transform('watch.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { $proxyMap, watch, $atom, $proxy, createClass } from '/@fs//path/to/valtio-kit/runtime.js'
      export const Counter = createClass(() => {
        let a = $atom(0);
        const b = $proxy({ c: { d: 1 } });
        let array = $atom([]);
        let map = /* @__PURE__ */ $atom($proxyMap());
        watch(($get) => {
          $get(a).value;
          a.value++;
          a.value = 1;
          $get(b).c.d;
          $get(b).c.d = 2;
          array.value = [2];
          map.value = /* @__PURE__ */ $proxyMap();
          let innerVar = 1;
          innerVar = 2;
        });
        return {};
      }, "Counter");
      "
    `)
  })

  test('dynamic param', async () => {
    const code = await transform('dynamic-param.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { onUpdate, $atom, createClass } from '/@fs//path/to/valtio-kit/runtime.js'
      export const Test1 = createClass((a, b = 0) => {
        a = $atom(a);
        onUpdate((...args) => [a.value] = args);
        return {};
      }, "Test1");
      export const Test2 = createClass(({ a, b = 0 }) => {
        a = $atom(a);
        onUpdate((...args) => ({ a: a.value } = args[0]));
        return {};
      }, "Test2");
      export const Test3 = createClass((a, b = 0) => {
        a = $atom(a);
        onUpdate((...args) => {
          a.value = args[0];
        });
        return {};
      }, "Test3");
      "
    `)
  })

  test('computed assignment', async () => {
    const code = await transform('computed-assignment.ts')
    expect(code).toMatchInlineSnapshot(`
      "import { computed, $assign, onUpdate, $atom, createClass } from '/@fs//path/to/valtio-kit/runtime.js'
      export const AudioPlayer = createClass((src) => {
        src = $atom(src);
        const audio = new HTMLAudioElement();
        $assign(audio, "src", (($get) => $get(src).value));
        onUpdate((...args) => [src.value] = args);
        return {};
      }, "AudioPlayer");
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
