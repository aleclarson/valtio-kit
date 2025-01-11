# Parameters

- This section is about the parameters passed to a `createClass` factory function. The parameters you declare in your factory function are what you must pass when using the **reactive class** via the `new` keyword or the `useInstance` hook.
- Parameters are **not** reactive if you never re-assign them. There's nothing to react to, in this case, because parameters aren't implicitly updated when `useInstance` is called with new values.
- If anywhere in your factory function you re-assign a parameter, the compiler notices and will make it _deeply_ reactive by default. In this sense, a parameter behaves identically to a [variable](/docs/variables.md).

## Live parameters

- If you want a parameter to update when `useInstance` is called with new values, you must explicitly make it live.
- To make a parameter live, use the `onUpdate` function like so:

```ts
const Counter = createClass((options: CounterOptions) => {
  onUpdate<typeof Counter>(newOptions => {
    Object.assign(options, newOptions)
  })
  return {
    /* ... */
  }
})
```
