import * as valtio from 'valtio'
import * as utils from 'valtio/utils'
import { AddEventListener } from './events'
import { EffectScope } from './scope'

export type Cleanup = () => void

export function onMount(fn: () => Cleanup) {
  EffectScope.current.constructors.push(scope => {
    scope.destructors.push(fn())
  })
}

export function watch(
  callback: () => void | Cleanup | Promise<void | Cleanup>,
  options?: { sync?: boolean }
) {
  EffectScope.current.constructors.push(scope => {
    scope.destructors.push(utils.watch(callback, options))
  })
}

export type Op = valtio.INTERNAL_Op

export function subscribe(
  target: object,
  callback: (unstable_ops: Op[]) => void,
  notifyInSync?: boolean
) {
  EffectScope.current.constructors.push(scope => {
    scope.destructors.push(valtio.subscribe(target, callback, notifyInSync))
  })
}

export function subscribeKey<T extends object, K extends keyof T>(
  target: T,
  key: K,
  callback: (value: T[K]) => void,
  notifyInSync?: boolean
) {
  EffectScope.current.constructors.push(scope => {
    scope.destructors.push(
      utils.subscribeKey(target, key, callback, notifyInSync)
    )
  })
}

/**
 * Event listeners added with this function are automatically cleaned up when
 * the associated state instance is destroyed.
 */
export const addEventListener: AddEventListener = (
  target: EventTarget,
  event: string,
  callback: (event: any) => any,
  options?: boolean | AddEventListenerOptions
) => {
  EffectScope.current.constructors.push(scope => {
    target.addEventListener(event, callback, options)
    scope.destructors.push(() => {
      target.removeEventListener(event, callback, options)
    })
  })
}