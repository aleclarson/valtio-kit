import { proxy } from 'valtio'
import { subscribe } from './effects'

const atoms = new WeakSet<object>()

/**
 * A proxy used to represent a reactive variable.
 */
export function atom<T>(value: T) {
  const result = proxy({ value })
  atoms.add(result)
  return result
}

const isAtom = (value: unknown): value is { value: unknown } =>
  typeof value === 'object' && value !== null && atoms.has(value)

/**
 * Check all immediate properties for atoms. These properties are bound to the
 * atom's value instead of the atom object itself.
 */
export function unnest(data: any) {
  data = proxy(data)
  Reflect.ownKeys(data).forEach(key => {
    const descriptor = Reflect.getOwnPropertyDescriptor(data, key)!
    if (
      descriptor.writable &&
      'value' in descriptor &&
      isAtom(descriptor.value)
    ) {
      const atom = descriptor.value
      data[key] = atom.value
      subscribe(atom, () => {
        data[key] = atom.value
      })
    }
  })
  return data
}
