import { EffectScope } from './scope'

let allowAutoRetain = () => true
export function setAllowAutoRetain(fn: () => boolean) {
  allowAutoRetain = fn
}

/**
 * The class extended by all reactive instances.
 *
 * If you create a reactive instance outside of a React component, the `using`
 * keyword is required. This ensures any persistent effects the instance created
 * are destroyed when it goes out of scope.
 */
export abstract class ReactiveInstance<T extends object> {
  // Does not exist at runtime.
  declare protected $data: T

  constructor() {
    if (allowAutoRetain()) {
      EffectScope.retain(this)
    }
  }

  /**
   * Dispose of any persistent effects created by the reactive instance. You
   * only need to call this if you created the instance outside of a React
   * component's render pass.
   */
  release(): void {
    EffectScope.release(this)
  }
}

/**
 * A reactive object returned by a `createClass` factory.
 */
export type ReactiveProxy<T extends object> = ReactiveInstance<T> & T

/**
 * A class for creating reactive instances with a specific factory.
 */
export interface ReactiveClass<Factory extends (...args: any[]) => object> {
  new (...args: Parameters<Factory>): ReactiveInstance<ReturnType<Factory>>
}
