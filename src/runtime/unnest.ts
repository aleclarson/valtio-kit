import { proxy } from 'valtio'
import { isAtom } from './atom'
import { subscribeKey } from './effects'

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
      subscribeKey(
        atom,
        'value',
        value => {
          data[key] = value
        },
        true
      )
    }
  })
  return data
}
