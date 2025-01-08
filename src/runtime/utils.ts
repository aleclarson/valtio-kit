import { isObject, isPlainObject } from 'radashi'
import { unstable_getInternalStates } from 'valtio'

const { proxyCache, proxyStateMap } = unstable_getInternalStates()

export function isProxy(value: unknown): value is object {
  return isObject(value) && proxyCache.has(value)
}

export function toRaw<T extends object>(value: T): T {
  const proxyState = proxyStateMap.get(value)
  return proxyState ? (proxyState[0] as T) : value
}

// Avoid deep-assigning proxy objects.
export function isDeepAssignable(value: any): value is object {
  return isPlainObject(value) && !proxyCache.has(value)
}

export function deepAssignArgs<T extends any[]>(target: T, source: T) {
  for (let i = 0; i < source.length; i++) {
    if (isPlainObject(target[i]) && isDeepAssignable(source[i])) {
      deepAssign(target[i], source[i])
    } else {
      target[i] = source[i]
    }
  }
  target.length = source.length
}

export function deepAssign<T extends object>(a: T, b: T) {
  for (const key in b) {
    if (isPlainObject(a[key]) && isDeepAssignable(b[key])) {
      deepAssign(a[key], b[key])
    } else {
      a[key] = b[key]
    }
  }
  for (const key in a) {
    if (!(key in b)) {
      a[key] = undefined as any
    }
  }
}
