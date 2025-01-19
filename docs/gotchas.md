# Gotchas

When learning valtio-kit's reactive model, it's common to get tripped up by
some of the nuances. This page is a collection of common pitfalls and how to
avoid them.

## Only reactive variables can be returned without a getter

One of the core insights of valtio-kit's design is making one-way bindings to your reactive variables easy to declare. That means you can return reactive variables directly from the factory function, and they will automatically update the reactive instance when they change.

```ts
const Counter = createClass(() => {
  let count = 0

  onMount(() => {
    const id = setInterval(() => {
      count++
    }, 1000)

    return () => clearInterval(id)
  })

  // This binds the `count` variable to the reactive instance.
  return { count }
})
```

This "one-way binding" only happens with reactive variables. Returning anything else, like a value from an object property, will not automatically update the reactive instance when it changes.

```ts
const Counter = createClass(() => {
  const state = { count: 0 }

  return {
    // ❌ Not reactive!
    count: state.count,
  }
})
```

If the value is from a reactive property, you can use `computed` to bind the value to the reactive instance.

```ts
const Counter = createClass(() => {
  const state = { count: 0 }

  return {
    count: computed(() => state.count),
  }
})
```
