import { isObject } from 'radashi'
import { proxy, unstable_getInternalStates } from 'valtio'

const proxyVars = new WeakSet<object>()

export const isProxyVar = (value: unknown): value is { value: unknown } =>
  isProxy(value) && proxyVars.has(value)

export function proxyVar<T>(value: T) {
  const result = proxy({ value })
  proxyVars.add(result)
  return result
}

const { proxyCache } = unstable_getInternalStates()

function isProxy(value: unknown): value is object {
  return isObject(value) && proxyCache.has(value)
}
