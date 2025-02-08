# React Integration

- There are 2 hooks in valtio-kit: `useInstance` and `useSnapshot`.
- `useInstance` creates an instance of a reactive class. It also sets up any persistent effects declared in the reactive class, and cleans them up when the component unmounts.
- `useSnapshot` creates a snapshot of a reactive instance. The snapshot is _immutable_ and _reactive_. The immutable nature of snapshots makes them a great fit with the new [React Compiler](https://react.dev/learn/react-compiler).
- Only `useSnapshot` will trigger component re-renders. It tracks which values your component is actually using, and will re-run the component when those values change.
- Often times, you need to _hoist_ state into a component that's higher in the React component tree. This is where `useInstance` is especially handy. Since `useInstance` never re-renders your component, your React app is optimized to only re-render where the data is actually used. In other words, to achieve optimal performance, your React app will re-render as deep in the component tree as possible.

```tsx
// src/state/AppState.state.ts
import { PartialDeep } from 'type-fest'
import { deepMerge } from './utils/deepMerge'

export const AppState = createClass(() => {
  const obj = { a: { b: 1, c: 2 } }

  subscribeKey(obj, 'a', () => console.log('a changed'))

  return {
    obj,
    patchObj(patch: PartialDeep<typeof obj>) {
      obj = deepMerge(obj, patch)
    },
  }
})

// src/App.tsx
import { useInstance, useSnapshot } from 'valtio-kit'
import { AppState } from './state/AppState.state'

function App() {
  // Create an instance and set up persistent effects.
  const state = useInstance(AppState)

  // Alternatively, you can use React Context to avoid prop drilling.
  return <LeafComponent state={state} />
}

function LeafComponent(props) {
  // The component that calls useSnapshot is the one that will
  // re-render when the used values change.
  const snapshot = useSnapshot(props.state)

  // Subscribe to changes in `obj.a.b` only.
  return <div>{snapshot.obj.a.b}</div>
}
```

## Context API

The `valtio-kit` React integration provides built-in support for React Context. This allows you to easily share reactive state between components without prop drilling.

```typescript
import { createClass, useInstance } from 'valtio-kit'
import * as React from 'react'

// Now you can use the Context and Provider properties on your reactive class
const MyClass = createClass(() => {
  return {
    value: 1
  }
})

function MyComponent() {
  const instance = React.use(MyClass.Context)

  return <div>{instance?.value}</div>
}

function App() {
  const instance = useInstance(MyClass)

  return (
    <MyClass.Provider value={instance}>
      <MyComponent />
    </MyClass.Provider>
  )
}
```

### createContextHooks

The `createContextHooks` function creates a pair of `useContext` hooks for a given reactive class. This makes it even easier to use the Context API.

The first hook returns `null` if the hook is called outside of a `Provider`. The second hook throws an error in that case.

```typescript
// src/state/Counter.state.ts
import { createClass, createContextHooks } from 'valtio-kit/react'
import * as React from 'react'

export const Counter = createClass(() => {
  return {
    value: 1,
    // todo: add methods here
  }
})

export const [useCounter, useCounterOrThrow] = createContextHooks(Counter)

// src/App.tsx
import { useInstance } from 'valtio-kit/react'
import { Counter, useCounter } from './state/Counter.state'

function CounterDisplay() {
  const counter = useCounter()

  return <div>{counter?.value}</div>
}

function App() {
  const counter = useInstance(Counter)

  return (
    <Counter.Provider value={counter}>
      <CounterDisplay />
    </Counter.Provider>
  )
}
```
