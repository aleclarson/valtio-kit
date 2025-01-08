import { watch } from 'valtio/utils'
import { atom } from './atom'
import { EffectScope } from './scope'

export function computed<T>(fn: () => T): T {
  const compute = fn as (get: (value: object) => object) => any
  const result = atom(compute(f => f))
  EffectScope.current.add(() => {
    return watch(get => {
      result.value = compute(get)
    })
  })
  return result as any
}
