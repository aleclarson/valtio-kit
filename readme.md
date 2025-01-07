# vite-react-state

```
pnpm add vite-react-state
```

## Usage

1. Create a module with a `.state.ts` or `.state.js` extension.

2. Keep your “state modules” in their own `src/state` folder. Then add a `tsconfig.json` with the following compiler option:

```json
"compilerOptions": {
  "types": ["vite-react-state/types"]
}
```

If you don't do this, you need to use a triple-slash directive instead:

```ts
/// <reference types="vite-react-state/types" />
```

3. Define your state module. For example, here's a simple counter:

```ts
export const useCounter = createState((initialCount = 0) => {
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

#### Terminology

The function passed to `createState` is known as the **factory function**, which initializes a **state instance** by returning an object literal. The function returned by `createState` is known as a **state hook**, which you can use in your React components.

## Rules

There are a few rules to keep in mind when writing a state hook:

- The `createState` callback must…
  - …require at least one parameter.
  - …return an object literal.
- Parameters cannot use nested destructuring (PR welcome).
- [Variable shadowing](https://dev.to/catherineisonline/what-is-variable-shadowing-in-javascript-59ci) is forbidden (PR welcome).

## Transformation

The plugin will transform any variable declarations at the root level of your state module's factory function, making them ✨reactive✨. Most of the time, you can write basic JavaScript and your React components will update when something they depend on changes.

Allow me to list all the things that will be transformed:

- Parameters of the factory function.
  - **Why?** These parameters are ✨reactive✨. In other words, the React component that initializes the _state instance_ can update these parameters by re-rendering and passing in new values.
- Variables declared at the root level of the factory function.
  - One _exception_ is `const` variables initialized with a function.
- References to transformed parameters and variables.
  - One _exception_ is when the reference is being assigned to a property of the _state instance_ (i.e. the object literal returned by the factory function). This ensures that reactive variables can be ✨observed✨ by React components.

## Context

Every state hook
