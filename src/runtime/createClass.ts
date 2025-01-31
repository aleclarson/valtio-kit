import { InstanceFactory, ReactiveClass, ReactiveInstance } from './instance'
import { EffectScope } from './scope'
import { unnest } from './unnest'

/**
 * Creates a `class` that produces a reactive object. The given `factory`
 * function is transformed at compile time. The logic contained within is plain
 * JavaScript that gets turbo-charged with Valtio-powered reactivity. The
 * factory function must return an object literal.
 *
 * Special functions exist for declaring managed side effects, like event
 * listeners or even Valtio-powered reactions that rerun when a value changes.
 * Here's a list of the special functions: `on`, `onMount`, `subscribe`,
 * `subscribeKey`, and `watch`.
 */
export function createClass<TFactory extends InstanceFactory>(
  factory: TFactory,
  name?: string
): ReactiveClass<TFactory> {
  const ReactiveClass = class extends ReactiveInstance<TFactory> {
    constructor(...args: Parameters<TFactory>) {
      super()
      const scope = this[EffectScope.symbol]
      scope.enter()
      try {
        var self = unnest(copyDescriptors(this, factory.apply(this, args)))
      } finally {
        scope.leave()
      }
      scope.autoSetup()
      return self
    }
  }
  Object.defineProperty(ReactiveClass, 'name', {
    value: name ?? factory.name,
  })
  return ReactiveClass as any
}

function copyDescriptors<T extends object>(target: T, source: object): T {
  return Object.defineProperties(
    target,
    Object.getOwnPropertyDescriptors(source)
  )
}
