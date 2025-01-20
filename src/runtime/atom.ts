import { proxy } from 'valtio'

const atoms = new WeakSet<object>()

/**
 * A proxy used to represent a reactive variable.
 */
export function atom<T>(value: T) {
  const result = proxy({ value })
  atoms.add(result)
  return result
}

export const isAtom = (value: unknown): value is { value: unknown } =>
  typeof value === 'object' && value !== null && atoms.has(value)
