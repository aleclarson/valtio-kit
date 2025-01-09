# vite-react-state

```
pnpm add vite-react-state
```

## Usage

1. Create a module with a `.state.ts` or `.state.js` extension.

2. Keep your “state module” in a dedicated `src/state` folder. Then add a `tsconfig.json` with the following compiler option:

```json
"compilerOptions": {
  "types": ["vite-react-state/globals"]
}
```

If you don't do this, you need to use a triple-slash directive instead:

```ts
/// <reference types="vite-react-state/globals" />
```

3. Call `createState` to define a reactive class. For example, here's a simple counter:

```ts
export const Counter = createState((initialCount = 0) => {
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

4. Initialize a reactive instance with the `useInstance` hook. Before using its data to render your component, you should first pass it to Valtio's `useSnapshot` hook.

```tsx
import { useInstance, useSnapshot } from 'vite-react-state/hooks'

export function App() {
  // Create a counter with an initial count of 100.
  const counter = useInstance(Counter, 100)

  // Subscribe to the counter's data.
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

#### Terminology

The function passed to `createState` is known as the **factory function**, which initializes a **reactive instance** by returning an object literal. The function returned by `createState` is known as a **reactive class**.

This package also borrows terminology from [Valtio](https://github.com/pmndrs/valtio). For example, a **snapshot** is an immutable copy of a reactive instance, which can intelligently rerender your React components if an accessed property changes. You **subscribe** to a reactive instance (or its property) to be notified when it changes. In Valtio, a reactive instance is referred to as a **proxy**.

## Rules

There are a few rules to keep in mind inside a `createState` factory function:

- You must return an object literal.
- Root-level `let` and `var` declarations are _deeply_ reactive by default.
- When you return a non-`const` variable as a property, a one-way binding is implicitly created, so assigning to the variable will re-render any components that use the property.
- Certain objects are _deeply_ reactive when assigned to root-level variables. This is even true when assignment occurs inside a nested function. Supported object types include:
  - plain objects
  - arrays
  - `new Map()`
  - `new Set()`
- Any time you construct a new `Map` or `Set` anywhere inside your factory function, it will be made _deeply_ reactive.
- The factory function can have arguments. Any kind and any number of arguments are supported.
- Passing a reactive instance into a factory function is not currently supported.
- _Variable shadowing_ is currently discouraged, as some edge cases have not yet been ironed out.

#### Persistent effects

Your `createState` factory function can set up persistent effects. If you construct a reactive instance **outside of a React component**, it's recommended to use the [`using`](https://www.totaltypescript.com/typescript-5-2-new-keyword-using) keyword to ensure any persistent effects are cleaned up when the reactive instance goes out of scope. Alternatively, you can call the `[Symbol.dispose]` method on the reactive instance to manually clean up its effects.

## API

The following functions are implicitly available within every `createState` factory function.

### `computed`

`computed` is a function that subscribes to reactive values and returns a new reactive value.

> [!NOTE]
> To use `computed`, you must use `const … = computed(() => …)` syntax. Using `computed` to define an object property is not yet supported.

```ts
const TacoExample = createState(() => {
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
const CatExample = createState(() => {
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
const ResizeExample = createState(() => {
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
const StyleSheetExample = createState(() => {
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

### `subscribe`

`subscribe` is a function that listens for changes to a given reactive object or even a reactive variable.

```ts
const SubscribeExample = createState(() => {
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
const SubscribeKeyExample = createState(() => {
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
