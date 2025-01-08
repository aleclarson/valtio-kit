import { isClass } from 'radashi'
import { useEffect, useMemo, useRef } from 'react'
import { EffectScope } from './scope'

/**
 * The class extended by all reactive instances.
 */
export abstract class ReactiveInstance<T extends object> {
  declare protected $data: T
}

/**
 * A reactive object returned by a `createState` factory.
 */
export type ReactiveProxy<T extends object> = ReactiveInstance<T> & T

/**
 * A class for creating reactive instances with a specific factory.
 */
export interface ReactiveClass<Factory extends (...args: any[]) => object> {
  new (...args: Parameters<Factory>): ReactiveInstance<ReturnType<Factory>>
}

/**
 * Create a new instance of the factory.
 */
export function useInstance<Factory extends (...args: any[]) => object>(
  constructor: ReactiveClass<Factory>,
  ...args: Parameters<Factory>
): ReactiveProxy<ReturnType<Factory>>

/**
 * Create a new instance of the factory. If you pass null or undefined, the hook
 * will return null.
 */
export function useInstance<Factory extends (...args: any[]) => object>(
  constructor: ReactiveClass<Factory> | null | undefined,
  ...args: Parameters<Factory>
): ReactiveProxy<ReturnType<Factory>> | null

/**
 * Create a new instance, using a dependency array for greater control over when
 * the instance should be re-created.
 */
export function useInstance<Factory extends (...args: any[]) => object>(
  create: () => ReactiveInstance<Factory>,
  deps: readonly any[]
): ReactiveProxy<ReturnType<Factory>>

/**
 * Create a new instance, using a dependency array for greater control over when
 * the instance should be re-created.
 */
export function useInstance<Factory extends (...args: any[]) => object>(
  create: () => ReactiveInstance<Factory> | null,
  deps: readonly any[]
): ReactiveProxy<ReturnType<Factory>> | null

export function useInstance(
  fn:
    | ReactiveClass<any>
    | (() => ReactiveInstance<any> | null)
    | null
    | undefined,
  ...args: any[]
) {
  let instance: ReactiveInstance<any> | null
  if (!fn || isClass(fn)) {
    const instanceRef = useRef<ReactiveInstance<any> | null>(null)
    instance = fn ? (instanceRef.current ?? new fn(...args)) : null
    useEffect(() => {
      instanceRef.current = instance
    })
  } else {
    instance = useMemo(fn, args[0] as readonly any[])
  }

  useEffect(() => {
    if (instance) {
      const scope = EffectScope.get(instance)!
      scope.mount()
      return () => {
        scope.unmount()
      }
    }
  }, [instance])

  return instance
}
