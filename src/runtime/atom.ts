import { proxy } from 'valtio'
import { kDebugContext, kDebugId } from './debug'

const atoms = new WeakSet<object>()

export const isAtom = (value: unknown): value is { value: unknown } =>
  typeof value === 'object' && value !== null && atoms.has(value)

/**
 * A proxy used to represent a reactive variable.
 */
export function atom<T>(value: T) {
  const result = proxy({ value })
  atoms.add(result)
  return result
}

export function atomDEV(value: unknown, name: string, context?: any) {
  const result = atom(value)
  if (context) {
    Object.defineProperty(result, kDebugContext, { value: context })
  }
  Object.defineProperty(result, kDebugId, { value: name })
  return result
}
