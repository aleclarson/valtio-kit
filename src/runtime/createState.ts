import { proxy } from 'valtio'
import { unnest } from './atom'
import { ReactiveClass, ReactiveInstance } from './instance'
import { EffectScope } from './scope'

export function createState<Factory extends (...args: any[]) => object>(
  create: Factory
): ReactiveClass<Factory> {
  return class extends ReactiveInstance<Factory> {
    constructor(...args: Parameters<Factory>) {
      super()
      const instance = proxy(this)
      const scope = new EffectScope(instance)
      scope.activate()
      try {
        return unnest(Object.assign(instance, create(...args)))
      } finally {
        scope.deactivate()
      }
    }
  }
}
