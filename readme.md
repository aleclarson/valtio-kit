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
  const counter = useInstance(Counter)
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
- Certain objects are _deeply_ reactive when assigned to root-level variables. This includes:
  - plain objects
  - arrays
  - `new Map()`
  - `new Set()`
- _Variable shadowing_ is currently discouraged, as some edge cases have not yet been ironed out.
