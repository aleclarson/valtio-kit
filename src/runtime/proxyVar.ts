import { proxy } from 'valtio'
import { isProxy } from './utils'

const proxyVars = new WeakSet<object>()

export const isProxyVar = (value: unknown): value is { value: unknown } =>
  isProxy(value) && proxyVars.has(value)

export function proxyVar<T>(value: T) {
  const result = proxy({ value })
  proxyVars.add(result)
  return result
}
