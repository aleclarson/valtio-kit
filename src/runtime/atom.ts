import { isObject } from 'radashi'
import { proxy, unstable_getInternalStates } from 'valtio'
import { subscribe } from './effects'

const atoms = new WeakSet<object>()

export const isAtom = (value: unknown): value is { value: unknown } =>
  isValtioProxy(value) && atoms.has(value)

export function atom<T>(value: T) {
  const result = proxy({ value })
  atoms.add(result)
  return result
}

const { proxyCache } = unstable_getInternalStates()

function isValtioProxy(value: unknown): value is object {
  return isObject(value) && proxyCache.has(value)
}

/**
 * First, convert the given `data` object to a Valtio proxy. Then check all
 * immediate properties for atoms. These atoms are subscribed to and their
 * values are used instead of the atoms themselves.
 */
export function unnest(data: any) {
  data = proxy(data)
  Reflect.ownKeys(data).forEach(key => {
    const descriptor = Reflect.getOwnPropertyDescriptor(data, key)!
    if (descriptor.writable && 'value' in descriptor) {
      const proxy = descriptor.value
      if (isAtom(proxy)) {
        data[key] = proxy.value
        subscribe(proxy, () => {
          data[key] = proxy.value
        })
      }
    }
  })
  return data
}
