import { unnest } from './atom'
import { InstanceFactory, ReactiveClass, ReactiveInstance } from './instance'
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
export function createClass<TFactory extends InstanceFactory>(
  factory: TFactory,
  name?: string
): ReactiveClass<TFactory> {
  const ReactiveClass = class extends ReactiveInstance<TFactory> {
    constructor(...args: Parameters<TFactory>) {
      super()
      this[EffectScope.symbol].enter()
      try {
        return unnest(copyDescriptors(this, factory(...args)))
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
