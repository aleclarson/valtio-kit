import { proxy } from 'valtio'
import { subscribe } from './effects'
import { ReactiveClass, ReactiveInstance } from './instance'
import { isProxyVar } from './proxyVar'
import { EffectScope } from './scope'
import { deepAssignArgs } from './utils'

export function createState<Factory extends (...args: any[]) => object>(
  create: Factory
): ReactiveClass<Factory> {
  return class extends ReactiveInstance<Factory> {
    constructor(...args: Parameters<Factory>) {
      super()
      this.args = proxy(args)
      this.scope = new EffectScope()
      this.scope.activate()
      try {
        const data: any = create(this.args)
        Reflect.ownKeys(data).forEach(key => {
          const descriptor = Reflect.getOwnPropertyDescriptor(data, key)!
          if (descriptor.writable && 'value' in descriptor) {
            const proxy = descriptor.value
            if (isProxyVar(proxy)) {
              data[key] = proxy.value
              subscribe(proxy, () => {
                data[key] = proxy.value
              })
            }
          }
        })
        this.data = data
      } finally {
        this.scope.deactivate()
      }
    }

    /**
     * Patch the instance arguments. This only has an effect if the instance set
     * up a `watch` or `subscribe` callback during initialization.
     */
    update(...args: Parameters<Factory>) {
      deepAssignArgs(this.args, args)
    }
  }
}
