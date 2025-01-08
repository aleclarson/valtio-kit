import * as runtime from './dist/runtime'

declare global {
  /**
   * Create a reactive, readonly value that is derived from other reactive values.
   * The given function is called immediately, and then again when the parent
   * component is mounted. The value is updated whenever the reactive values it
   * depends on change.
   */
  const computed: typeof runtime.computed
  /**
   * Creates a `class` that produces a reactive object. The given `factory`
   * function is transformed at compile time. The logic contained within is
   * plain JavaScript that gets turbo-charged with Valtio-powered reactivity.
   * The factory function must return an object literal.
   *
   * You can also declare persistent side effects, like event listeners or even
   * Valtio-powered reactions that rerun when a value changes. Any side effects
   * declared in the `factory` function will be managed for you, but you must
   * use one of the functions listed below to declare them.
   *
   * The following functions are implicitly available within your factory
   * function: `getVersion`, `on`, `onMount`, `ref`, `snapshot`, `subscribe`,
   * `subscribeKey`, and `watch`.
   */
  const createState: typeof runtime.createState
  /**
   * In Valtio, updates to proxied objects are tracked internally with a version
   * number.
   *
   * Every mutation to a proxy increases a global version number, and assigns the
   * just mutated proxy, and any parent proxies (which automatically subscribe to
   * their child proxies), to the latest version number.
   *
   * This is how `snapshot` knows whether a new snapshot is necessary: has my
   * proxy's version number changed since the last snapshot?
   *
   * Given its importance to valtio's internal behavior, the `getVersion` helper
   * can be used to check if a proxied object has been updated, but this is not
   * typically useful or recommended to use in application code because
   * `snapshot` and `useSnapshot` already handle version tracking internally.
   */
  const getVersion: typeof runtime.getVersion
  /**
   * Declare an event listener just like you would with `addEventListener`.
   *
   * The listener will be cleaned up when the component unmounts.
   */
  const on: typeof runtime.on
  /**
   * Declare a side effect that runs when the component mounts.
   *
   * You must return a cleanup function, which is called when the component
   * unmounts.
   */
  const onMount: typeof runtime.onMount
  /**
   * A `ref` is useful in the rare instances you need to nest an object in a
   * `proxy` that is not wrapped in an inner proxy and, therefore, is not
   * tracked.
   *
   * ```ts
   * const store = proxy({
   *   users: [
   *     { id: 1, name: 'Juho', uploads: ref([]) },
   *   ],
   * })
   * ```
   *
   * Once an object is wrapped in a `ref`, it should be mutated without
   * reassigning the object or rewrapping in a new `ref`.
   *
   * ```ts
   * // ✅ do mutate
   * store.users[0].uploads.push({ id: 1, name: "Juho" });
   * // ✅ do reset
   * store.users[0].uploads.splice(0);
   *
   * // ❌ don't reassign
   * store.users[0].uploads = [];
   * ```
   *
   * A `ref` should also not be used as the only state in a proxy, making the
   * proxy usage pointless.
   */
  const ref: typeof runtime.ref
  /**
   * `snapshot` takes a proxy and returns an immutable object, unwrapped from
   * the proxy.
   *
   * Immutability is achieved by _efficiently_ deep copying & freezing the
   * object (see the [Copy on Write][1] section for details).
   *
   * [1]: https://valtio.dev/docs/api/advanced/snapshot#copy-on-write
   *
   * Briefly, in sequential `snapshot` calls, when the values in the proxy have
   * not * changed, the previous snapshot's object reference is returned. This
   * allows for * shallow comparison in render functions, preventing spurious
   * renders.
   *
   * Snapshots also throw promises, making them work with React Suspense.
   *
   * @see https://valtio.dev/docs/api/advanced/snapshot
   */
  const snapshot: typeof runtime.snapshot
  /**
   * Subscribe to changes to an object, array, map, or set that was declared at
   * the root level of your `createState` factory function.
   *
   * ```ts
   * createState(() => {
   *   const state = { count: 0 }
   *
   *   // Subscribe to all changes to the state object (and its child objects)
   *   subscribe(state, () => {
   *     console.log('state has changed to', state)
   *   })
   * })
   * ```
   *
   * ---
   *
   * You can also subscribe to a portion of state.
   *
   * ```ts
   * const state = { obj: { foo: 'bar' }, arr: ['hello'] }
   *
   * subscribe(state.obj, () => console.log('state.obj has changed to', state.obj))
   * state.obj.foo = 'baz'
   *
   * subscribe(state.arr, () => console.log('state.arr has changed to', state.arr))
   * state.arr.push('world')
   * ```
   */
  const subscribe: typeof runtime.subscribe
  /**
   * Similar to `subscribe`, but only subscribes to changes to a specific key of
   * an object.
   */
  const subscribeKey: typeof runtime.subscribeKey
  /**
   * Declare a side effect that runs when the component mounts. Any reactive
   * values used within its `callback` will be tracked, causing the callback to
   * rerun when any of them change.
   */
  const watch: typeof runtime.watch
}

export {}
