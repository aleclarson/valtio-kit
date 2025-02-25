# valtio-kit

“Valtio Kit” is a smart way to handle the data in your React apps, especially if you're tired of complicated state management. As a plugin for Vite, it uses the power of Valtio to let you write state logic with minimal boilerplate in plain JavaScript or TypeScript. This means less complex code for you, and a faster experience for your users because your React components can now subscribe to the exact data they need.

```
pnpm add valtio-kit
```

- [StackBlitz playground](https://stackblitz.com/edit/valtio-kit?file=src%2FCounter.state.ts&terminal=dev)

## Usage

1. Add the Vite plugin to your `vite.config.ts` file.

```ts
import { valtioKit } from 'valtio-kit/vite'

export default defineConfig({
  plugins: [
    // These are the default options.
    valtioKit({
      include: /\.state\.[jt]s$/,
      exclude: /\/node_modules\//,
      globals: false,
    }),
  ],
})
```

2. Create a module with a `.state.ts` or `.state.js` extension.

3. (Optional) Enable the “globals API” to skip importing the various runtime functions provided by this package.

<details>
<summary><i>Enabling the globals API</i></summary>

- Keep your “state module” in a dedicated `src/state` folder. Then add a `tsconfig.json` with the following compiler option:

```json
"compilerOptions": {
  "types": ["valtio-kit/globals"]
}
```

- If you don't add a `tsconfig.json` file, you need to use a triple-slash directive instead:

```ts
/// <reference types="valtio-kit/globals" />
```

- Finally, set `globals: true` in your `vite.config.ts` file:

```ts
export default defineConfig({
  plugins: [valtioKit({ globals: true })],
})
```

</details>

4. Call `createClass` to define a reactive class. For example, here's a simple counter (please note that there's much, much more you can do with `createClass`):

```ts
import { createClass } from 'valtio-kit'

export const Counter = createClass((initialCount = 0) => {
  let count = initialCount

  return {
    count,
    increment(amount = 1) {
      count += amount
    },
    decrement(amount = 1) {
      count -= amount
    },
  }
})
```

> [!NOTE]
> The function passed to `createClass` is known as the **factory function**, which initializes a **reactive instance** by returning an object literal. The function returned by `createClass` is known as a **reactive class**.

5. Initialize a reactive instance with the `useInstance` hook. Before using its data to render your component, you should first pass it to Valtio's `useSnapshot` hook.

```tsx
import { useInstance, useSnapshot } from 'valtio-kit/react'
import { Counter } from './Counter.state'

export function App() {
  // Create a counter with an initial count of 100. Any persistent effects set up
  // by the instance will be cleaned up when the component unmounts.
  const counter = useInstance(Counter, 100)

  // Subscribe to the counter's data. Only the data you use will trigger re-renders.
  const { count, increment, decrement } = useSnapshot(counter)

  return (
    <div>
      Count: {count}
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  )
}
```

The `useInstance` hook _creates_ a reactive instance, which your React components can subscribe to using the `useSnapshot` hook.

#### Global state

In some cases, you may prefer to initialize a reactive instance outside of a React component. For example, you may want to initialize a global state object that can be accessed by any component.

```ts
import { Counter } from './Counter.state'

// Initialize a global counter with an initial count of 1.
export const counter = new Counter(1)
```

If your global instance sets up any persistent effects (i.e. `computed`, `watch`, `on`, etc.), you need to clean up the effects when Vite HMR is triggered.

```ts
import.meta.hot?.dispose(() => counter.release())
```

### Terminology

This package borrows terminology from [Valtio](https://github.com/pmndrs/valtio). For example, a **snapshot** is an immutable copy of a reactive instance, which can intelligently rerender your React components if an accessed property changes. You **subscribe** to a reactive instance (or its property) to be notified when it changes. In Valtio, a reactive instance is referred to as a **proxy**.

## Rules

There are a few rules to keep in mind inside a `createClass` factory function:

- You must return an object literal.
- Root-level `let` and `var` declarations are _deeply_ reactive by default.
- If you re-assign a factory parameter, it becomes _deeply_ reactive. Notably, this behavior does not apply to _properties_ of object/array parameters (unless you also re-assign the parameter itself).
- When you return a non-`const` variable as a property, a one-way binding is implicitly created, so assigning to the variable will re-render any components that use the property.
- Certain objects are _deeply_ reactive when assigned to root-level variables. This is even true when assignment occurs inside a nested function. Supported object types include:
  - plain objects
  - arrays
  - `new Map()`
  - `new Set()`
- The factory function can have arguments. Any kind and any number of arguments are supported.
- Passing a reactive instance into a factory function is not currently supported.

### Further Reading

Check out the `docs/` folder for more information.

- **Basics**
  - [Variables](/docs/variables.md)
  - [Parameters](/docs/parameters.md)
  - [Objects](/docs/objects.md)
  - [React Integration](/docs/react.md)
  - [Computed Bindings](/docs/computed.md)
- **Advanced**
  - [Gotchas](/docs/gotchas.md)
  - [Debugging](/docs/debug.md)
  - [Class Extensions](/docs/class-extension.md)

It's also recommended to read the API reference below.

## API

The valtio-kit API is intentionally minimal. Syntax sugar is generally avoided in favor of plain JavaScript. There exists utilities for readonly reactive values, reactive functions, managed event listeners, and snapshots.

### `computed`

`computed` is a function that subscribes to reactive values and returns a new reactive value.

> [!NOTE]
> Computed values _cannot_ be declared just anywhere. You can only call `computed` with the following syntax and it must be declared at the **root level** of a `createClass` factory function:
>
> ```ts
> // This is a readonly, computed variable.
> const xyz = computed(() => …)
>
> // This is a readonly, computed property.
> const foo = { bar: computed(() => …) }
>
> // This is a computed property assignment.
> foo.bar = computed(() => …)
> ```

```ts
const TacoExample = createClass(() => {
  let day = 'Monday'
  const taco = { type: 'beef' }
  const isTacoTuesday = computed(
    () => day === 'Tuesday' && taco.type === 'beef'
  )

  return {
    isTacoTuesday,
    setDay(newValue: string) {
      day = newValue
    },
    setTacoType(type: string) {
      taco.type = type
    },
  }
})

const example = new TacoExample()
example.isTacoTuesday // => false
example.setDay('Tuesday')
example.isTacoTuesday // => true
example.setTacoType('chicken')
example.isTacoTuesday // => false
```

### `watch`

`watch` is a persistent effect that reruns when its reactive dependencies change.

```ts
const CatExample = createClass(() => {
  // Any of this data can be watched.
  const cat = { name: 'Fluffy' }
  let numLives = 9

  watch(() => {
    console.log(
      `The cat named ${cat.name} has ${numLives} lives remaining. Meow!`
    )
  })

  return {
    renameCat(name: string) {
      cat.name = name
    },
    fallFromTree() {
      numLives--
    },
    eatFish() {
      numLives++
    },
  }
})

const cat = new CatExample()
// Logs "The cat named Fluffy has 9 lives remaining. Meow!"

cat.fallFromTree()
// Logs "The cat named Fluffy has 8 lives remaining. Meow!"

cat.renameCat('Whiskers')
// Logs "The cat named Whiskers has 8 lives remaining. Meow!"

cat.eatFish()
// Logs "The cat named Whiskers has 9 lives remaining. Meow!"
```

### `on`

`on` is a function that attaches an event listener to any `EventTarget`.

```ts
const ResizeExample = createClass(() => {
  let ratio = window.innerWidth / window.innerHeight
  on(window, 'resize', () => {
    ratio = window.innerWidth / window.innerHeight
  })
  return {
    ratio,
  }
})

const example = new ResizeExample()
example.ratio // Updates when the window is resized.
```

### `onMount`

`onMount` is a function that runs a callback when a reactive instance is mounted. The callback must return a cleanup function, which gets called when the reactive instance is unmounted.

```ts
const StyleSheetExample = createClass(() => {
  const style = document.createElement('style')
  onMount(() => {
    document.head.appendChild(style)
    return () => {
      document.head.removeChild(style)
    }
  })
  return {
    style,
  }
})

const example = new StyleSheetExample()
example.style.textContent = 'body { background-color: red; }'
```

### `onUpdate`

`onUpdate` is a function that runs a callback when a reactive instance has its `update` method called. It receives the latest factory arguments. This can happen one of two ways:

- By calling the `update` method directly.
- By a component re-rendering (but only if the `useInstance(MyClass, ...args)` hook signature is used). Notably, the `useInstance(() => new MyClass(), deps)` hook signature will never trigger `onUpdate` handlers.

```ts
const AudioPlayer = createClass((src: string) => {
  const audio = new HTMLAudioElement()
  // Update `audio.src` whenever `src` is changed.
  audio.src = computed(() => src)

  // By assigning to `src`, we make it reactive.
  onUpdate<typeof AudioPlayer>((...args) => ([src] = args))

  return {
    /* ... */
  }
})
```

### `subscribe`

`subscribe` is a function that listens for changes to a given reactive object or even a reactive variable.

```ts
const SubscribeExample = createClass(() => {
  let a = 0
  const b = { c: 1 }

  // Listen for changes to the `a` variable.
  subscribe(a, () => {
    console.log('a changed to', a)
  })

  // Listen for changes to the `b` object.
  subscribe(b, () => {
    console.log('b changed to', b)
  })

  return {
    update(update: { a: number; b: { c: number } }) {
      a = update.a
      Object.assign(b, update.b)
    },
  }
})

const example = new SubscribeExample()

example.update({ a: 1, b: { c: 2 } })
// Logs "a changed to 1"
// Logs "b changed to { c: 2 }"
```

### `subscribeKey`

`subscribeKey` is a function that listens for changes to a specific key of a reactive object.

```ts
const SubscribeKeyExample = createClass(() => {
  const b = { c: 1 }
  subscribeKey(b, 'c', () => {
    console.log('b.c changed to', b.c)
  })
  return {
    update(update: { b: { c: number } }) {
      Object.assign(b, update.b)
    },
  }
})

const example = new SubscribeKeyExample()

example.update({ b: { c: 1 } })
// Logs nothing since b.c is already 1

example.update({ b: { c: 2 } })
// Logs "b.c changed to 2"
```

### `snapshot`

`snapshot` is a function that returns an immutable, deep copy of a reactive object. [Learn more](https://valtio.dev/docs/api/advanced/snapshot)

### `ref`

`ref` is a function that prevents an object from being made reactive. [Learn more](https://valtio.dev/docs/api/advanced/ref)

### `getVersion`

`getVersion` is a function that returns a “version” number that represents when a reactive object was last updated. [Learn more](https://valtio.dev/docs/api/hacks/getVersion)
