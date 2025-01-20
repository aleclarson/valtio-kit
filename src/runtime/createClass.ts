import { unnest } from './atom'
import { InstanceFactory, ReactiveClass, ReactiveInstance } from './instance'
import { EffectScope } from './scope'

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
      this[EffectScope.symbol].enter()
      try {
        const self = unnest(copyDescriptors(this, factory(...args)))
        this[EffectScope.symbol].autoSetup()
        return self
      } finally {
        this[EffectScope.symbol].leave()
      }
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
