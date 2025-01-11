# Computed Bindings

- The `computed` function is used to create a reactive “binding” that recomputes a value based on other reactive values. It behaves identically to the `watch` function, except it's designed for declaring a readonly, reactive value. The function passed to `computed` is called the **compute function**.
- Computed bindings are _deeply_ reactive, though you typically shouldn't return an object from the compute function.
- Computed bindings can be declared in a few different ways:
  - As the value of a `const` variable  
    `const foo = computed(() => obj.bar.baz)`
  - As the value of a property in an object literal  
    `{ foo: computed(() => obj.bar.baz) }`
  - As the value of a property assignment expression  
    `obj.foo = computed(() => obj.bar.baz)`
    - Note that this won't make the target property itself reactive. In other words, you couldn't subscribe to `obj.foo` in this case unless `obj` was reactive.
- Currently, computed bindings can only be declared at the root level of a `createClass` factory function.
- Similarly to reactive variables, a `const` computed binding will be bound to the _reactive instance_ when you return it, using a one-way binding.
- Since computed bindings are reactive, you can chain them together. The only exception is when you're assigning a computed binding to a property of a **non-reactive** object.

```ts
const Example = createClass(() => {
  let a = 1
  // Reactive binding to the `b` const variable.
  const b = computed(() => a + 1)

  const audio = new HTMLAudioElement()
  // Reactive binding to the audio element's `src` property.
  audio.src = computed(() => b + '.mp3')

  const obj = {
    // ❌ The audio element is not reactive, so this will never update.
    foo: computed(() => audio.src),
  }

  // One-way binding to the outside world.
  return { b }
})
```
