# Objects

- Objects are _deeply_ reactive by default in the following cases:
  - When assigned to a reactive [variable](/docs/variables.md)
  - When added to a deeply reactive object (e.g. as the value of an object property, into an Array or Set, or as the value of a Map key)

## Getters and setters

- While [`get`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get) syntax is supported, it's not _always_ reactive. As a result, it can be a common source of bugs and should be avoided if possible.
  - If you must use it, you should avoid referencing any _reactive_ values except for those in the object itself (e.g. using `this.foo`). In fact, you should even avoid accessing `this.foo.bar` in a getter, since only `this.foo` will be reactive. This is a limitation of [Valtio](https://github.com/pmndrs/valtio).
- Similarly, [`set`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set) syntax is supported. There's nothing inherently dangerous with `set` syntax, but it should be used sparingly due to `get` syntax being so problematic.
- As a reminder, you don't need (and shouldn't use) `get` syntax to expose a reactive [variable](/docs/variables.md) to the outside world. Just assign the variable to a property of the returned object literal, and it will still be reactive. If that doesn't work for your use case, you should use a [computed binding](/docs/computed.md) instead.

## Gotchas

- It's not possible to subscribe _only_ to the "keys" or "indices" of a reactive object, array, etc. For example, using `Object.keys` on a reactive object within a `computed` or `watch` callback will subscribe to the object's keys _and values_. This means your callback will re-run when a key's value changes, even though you may only care about the keys themselves. This is a limitation of [Valtio](https://github.com/pmndrs/valtio). If you're doing expensive computations, you'll want to keep a reference to the previous keys for comparison and bail out when the keys haven't changed.

## Subscribing to changes

- Like with reactive variables, accessing a property of a reactive object within a `computed` or `watch` callback will subscribe to changes in that property.
  - Importantly, referencing a reactive object within `computed` or `watch` will subscribe to _all_ properties of that object, unless you access a specific property. The same is true for Array, Map, and Set objects, as well as _nested_ objects.
- You can deeply subscribe to changes in an object with the `subscribe` function.  
  `subscribe(obj, () => console.log('something in obj changed'))`
  - Your callback receives an array of operations that were performed on the object, but this API is not yet stable and may change in the future.
- You can subscribe to a single property of an object with the `subscribeKey` function.  
  `subscribeKey(obj, 'foo', () => console.log('foo changed'))`
  - If the property points to an object, that object will **not** be subscribed to. Only the property itself will be subscribed to.

```ts
const obj = { a: 1, b: { c: 2 } }

// Deeply subscribe to changes in an object.
subscribe(obj, () => console.log('something in obj changed'))

// Subscribe to changes in a single property of an object.
subscribeKey(obj, 'a', () => console.log('a changed'))

watch(() => {
  obj // Deeply subscribe to changes in `obj`
  obj.a // Subscribe to changes in `obj.a` only
  obj.b.c // Subscribe to changes in `obj.b.c` only
})
```
