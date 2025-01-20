import { proxy } from 'valtio'
import { isAtom } from './atom'
import { subscribe } from './effects'

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
      subscribe(
        atom,
        () => {
          data[key] = atom.value
        },
        true
      )
    }
  })
  return data
}
