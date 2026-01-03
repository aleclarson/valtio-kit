import { isClass } from 'radashi'
import { useEffect, useMemo, useRef } from 'react'
import type {
  InstanceFactory,
  ReactiveClass,
  ReactiveInstance,
  ReactiveProxy,
} from 'valtio-kit'
import { EffectScope } from 'valtio-kit/runtime'

/**
 * Create a new instance of the factory.
 */
export function useInstance<TFactory extends InstanceFactory>(
  constructor: ReactiveClass<TFactory>,
  ...args: Parameters<TFactory>
): ReactiveProxy<TFactory>

/**
 * Create a new instance of the factory. If you pass null or undefined, the hook
 * will return null.
 */
export function useInstance<TFactory extends InstanceFactory>(
  constructor: ReactiveClass<TFactory> | null | undefined,
  ...args: Parameters<TFactory>
): ReactiveProxy<TFactory> | null

/**
 * Create a new instance, using a dependency array for greater control over when
 * the instance should be re-created.
 */
export function useInstance<T extends ReactiveInstance<any>>(
  create: () => T,
  deps: readonly any[]
): ReactiveProxy<T>

/**
 * Create a new instance, using a dependency array for greater control over when
 * the instance should be re-created.
 */
export function useInstance<T extends ReactiveInstance<any>>(
  create: () => T | null,
  deps: readonly any[]
): ReactiveProxy<T> | null

export function useInstance(
  fn:
    | ReactiveClass<any>
    | (() => ReactiveInstance<any> | null)
    | null
    | undefined,
  ...args: unknown[]
) {
  let instance: ReactiveInstance<any> | null
  if (!fn || isClass(fn)) {
    const instanceRef = useRef<ReactiveInstance<any> | null>(null)
    instance = fn
      ? instanceRef.current?.constructor !== fn
        ? new fn(...args)
        : instanceRef.current
      : null

    useEffect(() => {
      instanceRef.current = instance
      instance?.update(...args)
    })
  } else {
    instance = useMemo(fn, args[0] as readonly any[])
  }

  useEffect(() => {
    if (instance) {
      instance[EffectScope.symbol].setup()
      return () => {
        instance[EffectScope.symbol].cleanup()
      }
    }
  }, [instance])

  return instance
}
