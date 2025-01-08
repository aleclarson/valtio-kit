import { proxy } from 'valtio'

const atoms = new WeakSet<object>()

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
  Reflect.ownKeys(data).forEach(key => {
    const descriptor = Reflect.getOwnPropertyDescriptor(data, key)!
    if (
      descriptor.configurable &&
      'value' in descriptor &&
      isAtom(descriptor.value)
    ) {
      Object.defineProperty(data, key, {
        enumerable: descriptor.enumerable,
        configurable: descriptor.configurable,
        get: Reflect.get.bind(Reflect, descriptor.value, 'value'),
      })
    }
  })
  return data
}
