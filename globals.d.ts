import type * as valtioKit from './dist/index'

declare global {
  /**
   * Create a reactive, readonly value that is derived from other reactive values.
   * The given function is called immediately, and then again when the parent
   * component is mounted. The value is updated whenever the reactive values it
   * depends on change.
   */
  const computed: typeof valtioKit.computed
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
  const getVersion: typeof valtioKit.getVersion
  /**
   * Declare an event listener just like you would with `addEventListener`.
   *
   * The listener will be cleaned up when the component unmounts.
   */
  const on: typeof valtioKit.on
  /**
   * Declare a side effect that runs when the component mounts.
   *
   * You must return a cleanup function, which is called when the component
   * unmounts.
   */
  const onMount: typeof valtioKit.onMount
  /**
   * Declare a side effect that runs when the component updates. It receives the
   * latest arguments passed to the `useInstance` hook.
   */
  const onUpdate: typeof valtioKit.onUpdate
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
  const ref: typeof valtioKit.ref
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
  const snapshot: typeof valtioKit.snapshot
  /**
   * Subscribe to changes to an object, array, map, or set that was declared at
   * the root level of your `createClass` factory function.
   *
   * ```ts
   * createClass(() => {
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
  const subscribe: typeof valtioKit.subscribe
  /**
   * Similar to `subscribe`, but only subscribes to changes to a specific key of
   * an object.
   */
  const subscribeKey: typeof valtioKit.subscribeKey
  /**
   * Declare a side effect that runs when the component mounts. Any reactive
   * values used within its `callback` will be tracked, causing the callback to
   * rerun when any of them change.
   */
  const watch: typeof valtioKit.watch
}

export {}
