import { unnest } from './atom'
import { ReactiveClass, ReactiveInstance } from './instance'
import { EffectScope } from './scope'

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
export function createClass<Factory extends (...args: any[]) => object>(
  factory: Factory
): ReactiveClass<Factory> {
  return class extends ReactiveInstance<ReturnType<Factory>> {
    constructor(...args: Parameters<Factory>) {
      super()
      const scope = new EffectScope()
      scope.enter()
      try {
        const self = unnest(copyDescriptors(this, factory(...args)))
        EffectScope.assign(self, scope)
        return self
      } finally {
        scope.leave()
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
