import fs from 'node:fs'
import path from 'node:path'
import { createServer } from 'vite'
import { Options, valtioKit } from '../src/vite/plugin.js'

describe('valtio-kit', () => {
  test('let variable', async () => {
    const code = await transform('let-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass } from "valtio-kit";
      export const Test = createClass(() => {
        let a = V.atom(0);
        let b = V.atom({
          c: 0,
          d: 0,
          // Nested objects/arrays are not wrapped with $proxy, but they will still be
          // deeply reactive.
          nestedObject: {},
          nestedArray: []
        });
        let c = V.atom([]);
        let d = /* @__PURE__ */ V.atom(V.proxyMap());
        let e = /* @__PURE__ */ V.atom(V.proxySet());
        let f = () => {
          a.value++;
          b.value = { c: 1, d: 1, nestedObject: {}, nestedArray: [] };
          b.value.c++;
          b.value.d = 1;
          b.value.d;
          c.value = [1];
          c.value.push(2);
          d.value = /* @__PURE__ */ V.proxyMap();
          d.value.set(1, 1);
          e.value = /* @__PURE__ */ V.proxySet();
          e.value.add(1);
          let nestedVar = 0;
          nestedVar++;
        };
        let a2 = 0;
        let b2 = V.proxy({});
        let c2 = V.proxy([]);
        let d2 = /* @__PURE__ */ V.proxyMap();
        let e2 = /* @__PURE__ */ V.proxySet();
        return {
          f,
          a2,
          b2,
          c2,
          d2,
          e2
        };
      }, "Test");
      "
    `)
  })

  test('const variable', async () => {
    const code = await transform('const-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass } from "valtio-kit";
      export const Test = createClass(() => {
        const a = 0;
        const b = V.proxy({});
        const c = V.proxy([]);
        const d = /* @__PURE__ */ V.proxyMap();
        const e = /* @__PURE__ */ V.proxySet();
        const f = () => {
          const nestedConst = { a: 1 };
          nestedConst.a++;
        };
        return {};
      }, "Test");
      "
    `)
  })

  test('destructured variable', async () => {
    const code = await transform('destructured-variable.ts')
    expect(code).toMatchInlineSnapshot(`
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass } from "valtio-kit";
      export const Point2D = createClass(({ x, y }, options) => {
        x = V.atom(x);
        const { rotation = 0 } = options;
        let { scale = 1, origin = { x: 0, y: 0 } } = options; scale = V.atom(scale);
        let [foo, bar] = options.array; foo = V.atom(foo);
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
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass } from "valtio-kit";
      export const Test = createClass(() => {
        let a = V.atom(0);
        const b = V.proxy({ a: a.value });
        return {
          a,
          b,
          c: V.unnest({
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
      }, "Test");
      "
    `)
  })

  test('return arrow function', async () => {
    const code = await transform('return-arrow-function.ts')
    expect(code).toMatchInlineSnapshot(`
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass } from "valtio-kit";
      export const Counter = createClass(() => {
        let status = V.atom(null);
        return () => ({
          status,
          setStatus(newStatus) {
            status.value = newStatus;
          },
          reset() {
            status.value = null;
          }
        });
      }, "Counter");
      "
    `)
  })

  test('subscribe', async () => {
    const code = await transform('subscribe.ts')
    expect(code).toMatchInlineSnapshot(`
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass } from "valtio-kit";
      export const Test = createClass(() => {
        let a = V.atom(0);
        const b = V.proxy({ c: 1 });
        V.subscribe(a, () => {
          console.log("a changed to", a.value);
        });
        V.subscribe(b, () => {
          console.log("b changed to", b);
        });
        return {};
      }, "Test");
      "
    `)
  })

  test('watch', async () => {
    const code = await transform('watch.ts')
    expect(code).toMatchInlineSnapshot(`
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass } from "valtio-kit";
      export const Test = createClass(() => {
        let a = V.atom(0);
        const b = V.proxy({ c: { d: 1 } });
        let array = V.atom([]);
        let map = /* @__PURE__ */ V.atom(V.proxyMap());
        V.watch(($get) => {
          $get(a).value;
          a.value++;
          a.value = 1;
          $get(b).c.d;
          $get(b).c.d = 2;
          array.value = [2];
          map.value = /* @__PURE__ */ V.proxyMap();
          let innerVar = 1;
          innerVar = 2;
        });
        return {};
      }, "Test");
      "
    `)
  })

  test('dynamic param', async () => {
    const code = await transform('dynamic-param.ts')
    expect(code).toMatchInlineSnapshot(`
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass } from "valtio-kit";
      export const Test1 = createClass((a, b = 0) => {
        a = V.atom(a);
        V.onUpdate((...args) => [a.value] = args);
        return {};
      }, "Test1");
      export const Test2 = createClass(({ a, b = 0 }) => {
        a = V.atom(a);
        V.onUpdate((...args) => ({ a: a.value } = args[0]));
        return {};
      }, "Test2");
      export const Test3 = createClass((a, b = 0) => {
        a = V.atom(a);
        V.onUpdate((...args) => {
          a.value = args[0];
        });
        return {};
      }, "Test3");
      "
    `)
  })

  test('computed', async () => {
    const code = await transform('computed.ts')
    expect(code).toMatchInlineSnapshot(`
      "import * as V from '/@fs//path/to/valtio-kit/runtime.js'
      import { createClass, proxy } from "valtio-kit";
      export const Test = createClass((options) => {
        options = proxy(options);
        const a = V.unnest({
          b: V.computed(($get) => $get(options).b),
          c: 0
        });
        V.assign(a, "c", (($get) => $get(options).c));
        const d = V.computed(($get) => $get(a).b + $get(a).c);
        return {
          a,
          d,
          e: V.computed(($get) => $get(a).b + $get(a).c)
        };
      }, "Test");
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
    mode: 'production',
    logLevel: 'silent',
    configFile: false,
    plugins: [
      valtioKit({
        ...options,
        globals: true,
        include: /\.[jt]s$/,
        runtimePath: '/@fs//path/to/valtio-kit/runtime.js',
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
