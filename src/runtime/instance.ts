import { EffectScope } from './scope'

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
export type InstanceFactory<TState extends InstanceState = InstanceState> = (
  ...args: any[]
) => TState | (() => TState)

/**
 * The class extended by all reactive instances.
 *
 * If you create a reactive instance outside of a React component, the `using`
 * keyword is required. This ensures any persistent effects the instance created
 * are destroyed when it goes out of scope.
 */
export abstract class ReactiveInstance<TFactory extends InstanceFactory> {
  // Does not exist at runtime.
  declare protected $data: TFactory extends InstanceFactory<infer TState>
    ? TState
    : never

  // The store for persistent effects and update handlers.
  declare protected [EffectScope.symbol]: EffectScope

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
 * A reactive object returned by a `createClass` factory. Its state is protected
 * from outside modification.
 */
export type ReactiveProxy<T> =
  T extends InstanceFactory<infer TState>
    ? ReactiveInstance<T> & Readonly<Omit<TState, keyof InstanceState>>
    : T extends ReactiveInstance<infer TFactory>
      ? ReactiveProxy<TFactory>
      : never
