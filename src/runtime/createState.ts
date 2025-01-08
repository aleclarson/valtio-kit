import { unnest } from './atom'
import { ReactiveClass, ReactiveInstance } from './instance'
import { EffectScope } from './scope'

export function createState<Factory extends (...args: any[]) => object>(
  factory: Factory
): ReactiveClass<Factory> {
  return class extends ReactiveInstance<ReturnType<Factory>> {
    constructor(...args: Parameters<Factory>) {
      super()
      const scope = new EffectScope()
      scope.activate()
      try {
        const self = unnest(copyDescriptors(this, factory(...args)))
        EffectScope.set(self, scope)
        return self
      } finally {
        scope.deactivate()
      }
    }
  }
}

function copyDescriptors<T extends object>(target: T, source: object): T {
  return Object.defineProperties(
    target,
    Object.getOwnPropertyDescriptors(source)
  )
}
