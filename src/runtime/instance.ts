import { isClass, isFunction } from 'radashi'
import { useEffect, useMemo, useRef } from 'react'
import { Snapshot, useSnapshot } from 'valtio'
import { EffectScope } from './scope'
import { toRaw } from './utils'

/**
 * Represents an instance of a `createState` factory.
 */
export abstract class ReactiveInstance<
  Factory extends (...args: any[]) => object,
> {
  declare protected data: ReturnType<Factory>
  declare protected args: Parameters<Factory>
  declare protected scope: EffectScope
  abstract update(...args: Parameters<Factory>): void
}

export interface ReactiveClass<Factory extends (...args: any[]) => object> {
  new (...args: Parameters<Factory>): ReactiveInstance<Factory>
}

/**
 * Use an immutable snapshot of the instance's data.
 */
export function useInstance<T extends (...args: any[]) => object>(
  instance: ReactiveInstance<T>
): Snapshot<ReturnType<T>>

/**
 * Create a new instance of the factory.
 */
export function useInstance<T extends (...args: any[]) => object>(
  factory: new (...args: Parameters<T>) => ReactiveInstance<T>,
  ...args: Parameters<T>
): ReactiveInstance<T>

/**
 * Create a new instance of the factory. If you pass null or undefined, the hook
 * will return null.
 */
export function useInstance<T extends (...args: any[]) => object>(
  factory:
    | (new (...args: Parameters<T>) => ReactiveInstance<T>)
    | null
    | undefined,
  ...args: Parameters<T>
): ReactiveInstance<T> | null

/**
 * Create a new instance, using a dependency array for greater control over when
 * the instance should be re-created.
 */
export function useInstance<T extends (...args: any[]) => object>(
  factory: () => ReactiveInstance<T>,
  deps: readonly any[]
): ReactiveInstance<T>

/**
 * Create a new instance, using a dependency array for greater control over when
 * the instance should be re-created.
 */
export function useInstance<T extends (...args: any[]) => object>(
  factory: () => ReactiveInstance<T> | null,
  deps: readonly any[]
): ReactiveInstance<T> | null

export function useInstance(
  arg1:
    | ReactiveInstance<any>
    | (() => ReactiveInstance<any> | null)
    | (new (...args: any[]) => ReactiveInstance<any>)
    | null
    | undefined,
  ...factoryArgs: any[]
) {
  if (!arg1 || isFunction(arg1)) {
    const instanceRef = useRef<ReactiveInstance<any> | null>(null)

    let instance: ReactiveInstance<any> | null
    if (!arg1) {
      instance = null
    } else if (isClass(arg1)) {
      instance = new arg1(...factoryArgs)
    } else {
      instance = useMemo(arg1, factoryArgs[0] as readonly any[])
    }

    useEffect(() => {
      instanceRef.current = instance
      if (instance && factoryArgs !== toRaw(instance['args'])) {
        instance.update(...factoryArgs)
      }
    })

    useEffect(() => {
      if (!instance) return
      instance['scope'].mount()
      return () => {
        instance['scope'].unmount()
      }
    }, [instance])

    return instance
  }

  return useSnapshot(arg1['data'])
}
