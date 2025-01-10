import { EffectScope } from './scope'

let allowAutoRetain = () => true
export function setAllowAutoRetain(fn: () => boolean) {
  allowAutoRetain = fn
}

declare class ReservedProperty<Message extends string> {
  private readonly message: Message
}

/**
 * This type prevents a `createClass` factory from overriding built-in methods
 * of the `ReactiveInstance` class.
 */
export type InstanceState = object & {
  update?: ReservedProperty<'Every reactive instance has an `update` method that is called by the useInstance hook (and can also be called manually).'>
  release?: ReservedProperty<'Every reactive instance has a `release` method that is used to manually cleanup any persistent effects created by the instance.'>
}

/**
 * The type constraint for a `createClass` factory.
 */
export type InstanceFactory = (...args: any[]) => InstanceState

/**
 * The class extended by all reactive instances.
 *
 * If you create a reactive instance outside of a React component, the `using`
 * keyword is required. This ensures any persistent effects the instance created
 * are destroyed when it goes out of scope.
 */
export abstract class ReactiveInstance<TFactory extends InstanceFactory> {
  // Does not exist at runtime.
  declare protected $data: ReturnType<TFactory>

  // The store for persistent effects and update handlers.
  protected [EffectScope.symbol] = new EffectScope()

  constructor() {
    if (allowAutoRetain()) {
      this[EffectScope.symbol].setup()
    }
  }

  /**
   * Update the instance with new arguments.
   *
   * You don't need to call this if you're using `useInstance(MyClass, ...args)`
   * call signature, but otherwise you do (if your instance has an `onUpdate`
   * handler).
   */
  update(...args: Parameters<TFactory>) {
    this[EffectScope.symbol].updateEffects?.forEach(effect => effect(...args))
  }

  /**
   * Dispose of any persistent effects created by the reactive instance. You
   * only need to call this if you created the instance outside of a React
   * component's render pass.
   */
  release() {
    this[EffectScope.symbol].cleanup()
  }
}

/**
 * A reactive object returned by a `createClass` factory.
 */
export type ReactiveProxy<TFactory extends InstanceFactory> =
  ReactiveInstance<TFactory> & Omit<ReturnType<TFactory>, keyof InstanceState>

/**
 * A class for creating reactive instances with a specific factory.
 */
export interface ReactiveClass<TFactory extends InstanceFactory> {
  new (...args: Parameters<TFactory>): ReactiveProxy<TFactory>
}
