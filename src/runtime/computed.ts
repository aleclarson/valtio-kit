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
export function computed<T>(fn: () => T): T {
  const compute = fn as (get: (value: object) => object) => any
  const result = atom(compute(f => f))
  EffectScope.addSetupEffect(() => {
    return watch(get => {
      result.value = compute(get)
    })
  })
  return result as any
}
