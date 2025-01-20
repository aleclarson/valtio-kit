import { isFunction } from 'radashi'
import { watch } from 'valtio/utils'
import { atom } from './atom'
import { EffectScope } from './scope'

/**
 * Create a reactive, readonly value that is derived from other reactive values.
 * The given function is called immediately, and then again when the parent
 * component is mounted. The value is updated whenever the reactive values it
 * depends on change.
 *
 * Note: Your compute function must not have any side effects.
 */
export function computed<const T>(fn: () => T): T {
  const compute = fn as (get: (value: object) => object) => any
  const result = atom(compute(f => f))
  EffectScope.addSetupEffect(() => {
    return watch(
      get => {
        result.value = compute(get)
      },
      { sync: true }
    )
  })
  return result as any
}

/** @internal */
export function assign(
  object: any,
  key: PropertyKey | (() => PropertyKey),
  compute: (get: (value: object) => object) => unknown
) {
  object = toGetter(object)
  key = toGetter(key)

  // The initial value must be computed immediately.
  let memo = (object()[key()] = compute(f => f))

  EffectScope.addSetupEffect(() => {
    return watch(get => {
      // Only assign if the computed value has changed.
      if (!Object.is(memo, (memo = compute(get)))) {
        object()[key()] = memo
      }
    })
  })
}

function toGetter<T>(value: T | (() => T)) {
  return isFunction(value) ? value : () => value
}
