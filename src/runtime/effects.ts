import * as valtio from 'valtio'
import * as utils from 'valtio/utils'
import { AddEventListener } from './eventTypes'
import { EffectScope } from './scope'

export type Cleanup = () => void

/**
 * Declare a side effect that runs when the reactive instance is retained (i.e.
 * when its parent component is mounted).
 *
 * You must return a cleanup function, which is called when the reactive
 * instance is no longer needed (e.g. the React component that owned it was
 * unmounted).
 */
export const onMount = EffectScope.addSetupEffect

/**
 * Receive the latest arguments when the parent component rerenders.
 */
export const onUpdate = EffectScope.addUpdateEffect

/**
 * Declare a side effect that runs when the reactive instance is no longer
 * needed (e.g. the React component that owned it was unmounted).
 */
export const onUnmount = EffectScope.addCleanupEffect

/**
 * Declare a side effect that runs when the component mounts. Any reactive
 * values used within its `callback` will be tracked, causing the callback to
 * rerun when any of them change.
 */
export function watch(
  callback: () => void | Cleanup | Promise<void | Cleanup>,
  options?: { sync?: boolean }
) {
  EffectScope.addSetupEffect(() => utils.watch(callback, options))
}

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
export function subscribe(
  target: unknown,
  callback: (unstable_ops: valtio.INTERNAL_Op[]) => void,
  notifyInSync?: boolean
) {
  // This type guard helps prevent misuse while still allowing `let` variables
  // to be used as targets.
  if (typeof target !== 'object' || target === null) {
    throw new Error('Target must be an object')
  }
  EffectScope.addSetupEffect(() =>
    valtio.subscribe(target, callback, notifyInSync)
  )!
}

/**
 * Similar to `subscribe`, but only subscribes to changes to a specific key of
 * an object.
 */
export function subscribeKey<T extends object, K extends keyof T>(
  target: T,
  key: K,
  callback: (value: T[K]) => void,
  notifyInSync?: boolean
) {
  EffectScope.addSetupEffect(() =>
    utils.subscribeKey(target, key, callback, notifyInSync)
  )
}

/**
 * Declare an event listener just like you would with `addEventListener`.
 *
 * The listener will be cleaned up when the component unmounts.
 */
export const on: AddEventListener<void> = (
  target: EventTarget,
  event: string,
  callback: (event: any) => any,
  options?: boolean | AddEventListenerOptions
) => {
  EffectScope.addSetupEffect(() => {
    target.addEventListener(event, callback, options)
    return () => {
      target.removeEventListener(event, callback, options)
    }
  })
}

/**
 * Run a callback when a reactive condition is truthy.
 *
 * Your callback may set up its own side effects, which will be cleaned up when the
 * condition is no longer met.
 */
export function when(
  predicate: () => boolean,
  callback: () => void | Cleanup | Promise<void | Cleanup>
) {
  EffectScope.addSetupEffect(() => {
    const shouldRun = predicate as (get: Function) => boolean
    const scope = new EffectScope()

    return utils.watch(get => {
      let result: any
      if (shouldRun(get)) {
        result = scope.run(callback)
        scope.autoSetup()
      } else {
        scope.autoCleanup()
      }
      return result
    })
  })
}
