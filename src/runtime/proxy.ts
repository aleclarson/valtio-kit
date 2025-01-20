import { proxy as createProxy, unstable_getInternalStates } from 'valtio'

const { proxyStateMap } = unstable_getInternalStates()

export function proxy<T extends object>(data: T): T {
  if (proxyStateMap.has(data)) {
    return data
  }
  return createProxy(data)
}
