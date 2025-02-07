# Debugging

The `inspectValtio` function exported by the `valtio-kit/debug` module allows you to hook into Valtio's change detection for debugging purposes. Since calling `inspectValtio` is only supported in Vite's dev mode, you'll want to wrap it in a conditional like so:

```ts
import { inspectValtio } from 'valtio-kit/debug'

if (import.meta.env.DEV) {
  inspectValtio()
}
```

By default, `inspectValtio` will log changes to **reactive instances** and **reactive variables**. Let's go over how to customize this behavior.

## Filtering Updates

You can filter which updates get logged using various filtering options:

```ts
import { wild } from 'valtio-kit/debug'

inspectValtio({
  filters: [
    // Filter by target ID or object
    { targetFilter: 'User(1)' },
    { targetFilter: /^User\b/ },
    { targetFilter: obj => obj instanceof User },

    // Filter by target kind
    { targetKindFilter: 'instance' }, // 'instance' | 'proxy' | 'variable'

    // Filter by property path
    { pathFilter: ['name'] },
    { pathFilter: [/items\.\d+/] },
    { pathFilter: ['items', wild, 'name'] }, // Use wild to match any path segments

    // Filter method calls
    { methodFilter: 'push' },
    { methodFilter: /^(push|pop)$/ },

    // Exclude matches from logging
    { targetFilter: 'User(1)', exclude: true },

    // Custom match handler
    {
      targetFilter: 'User(1)',
      onMatch(event) {
        // Called when filter matches
        console.log('Matched:', event)
        // Great for conditional breakpoints
        debugger
      },
    },
  ],
})
```

## Logging Options

The `inspectValtio` function accepts several logging-related options:

```ts
inspectValtio({
  // Log method calls on proxy objects
  logMethodCalls: true,

  // Snapshot target objects before logging them
  logTargetSnapshots: true,

  // Include stack traces in logs
  trace: true,

  // Custom update handler
  onUpdate(update) {
    const { targetId, target, path, op, value, oldValue } = update
    console.log(`${targetId}${path.join('.')} ${op}:`, value)
  },

  // Custom method call handler
  onCall(call) {
    const { targetId, path, method, args } = call
    console.log(`${targetId}${path.join('.')} ${method}:`, args)
  },
})
```

The `update` object passed to the `onUpdate` callback is of the following type:

```ts
export type ValtioUpdate = {
  targetId: string
  target: object
  path: readonly (string | symbol)[]
  op: 'set' | 'delete'
  value: unknown
  oldValue: unknown
}
```

Notably, the `target` object is _never_ a proxy. If you need the target proxy, pass it to `proxy()` and the same proxy being used elsewhere in your code will be returned back to you.

## Debug IDs

Debug IDs are used in the logs to identify the source of updates. **Reactive instances** are automatically assigned debug IDs, but only after being updated for the first time (or when passed to `getDebugId`).

```ts
import { setDebugId, getDebugId } from 'valtio-kit/debug'
import { User } from './User.state.ts'

// Auto-generated ID based on constructor name
const user = new User({ name: 'John' })
getDebugId(user) // => "User(1)"

// Manual ID assignment
setDebugId(user, 'AdminUser')
getDebugId(user) // => "AdminUser"

// The "id" property is used if it's a string or number.
const user = new User({ id: 123, name: 'John' })
getDebugId(user) // => "User(123)"
```

> [!NOTE]
> Plain objects, arrays, and `Map`/`Set` instances won't have debug IDs unless manually assigned with `setDebugId`.

## Method Call Handling

Method calls on proxied arrays are coalesced into single events by default. For example, when calling `array.push()`, instead of seeing individual property updates, you'll see a single `PUSH` operation with the arguments. Only calls that lead to mutations are reported.

```ts
const items = proxy([1, 2, 3])
setDebugId(items, 'items')

items.push(4, 5)
// Logs: "PUSH items [4, 5]" instead of individual array updates
```

Reactive instances will have their methods tracked and logged as well, but these calls will appear as `CALL` operations in the logs. These calls are reported whether or not they lead to mutations.
