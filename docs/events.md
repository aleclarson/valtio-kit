# Events

Reactive classes can be “event targets”, which means they can emit events and have listeners attached to them.

It's as easy as calling `createEventTarget` in the factory function.

```ts
import { createEventTarget, createClass } from 'valtio-kit'

export const Example = createClass(() => {
  const [eventsMixin, emit] = createEventTarget<{
    // A variable number of arguments.
    foo: number[]
    // A zero-argument event.
    bar: []
  }>()

  // Emit these from your methods or event handlers.
  emit('foo', 1, 2, 3, 4, 5)
  emit('bar')

  return {
    // Expose the `addEventListener` and `removeEventListener` methods.
    ...eventsMixin,
  }
})
```

It's recommended to _not_ return the `emit` function, as it encourages “action-at-a-distance” code, which is notoriously hard to maintain. If you find yourself writing a method that only emits an event, you're probably doing something wrong. Emitting an event should be a side effect of some other action. Importantly, you shouldn't be adding events until you have a use case that's best served by them.
