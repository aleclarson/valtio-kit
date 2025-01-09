import * as valtio from 'valtio'
import * as utils from 'valtio/utils'
import { AddEventListener } from './events'
import { EffectScope } from './scope'

export type Cleanup = () => void

export function onMount(fn: () => Cleanup) {
  EffectScope.current.add(fn)
}

export function watch(
  callback: () => void | Cleanup | Promise<void | Cleanup>,
  options?: { sync?: boolean }
) {
  EffectScope.current.add(() => utils.watch(callback, options))
}

export type Op = valtio.INTERNAL_Op

export function subscribe(
  target: unknown,
  callback: (unstable_ops: Op[]) => void,
  notifyInSync?: boolean
) {
  if (typeof target !== 'object' || target === null) {
    throw new Error('Target must be an object')
  }
  EffectScope.current.add(() =>
    valtio.subscribe(target, callback, notifyInSync)
  )
}

export function subscribeKey<T extends object, K extends keyof T>(
  target: T,
  key: K,
  callback: (value: T[K]) => void,
  notifyInSync?: boolean
) {
  EffectScope.current.add(() =>
    utils.subscribeKey(target, key, callback, notifyInSync)
  )
}

/**
 * Event listeners added with this function are automatically cleaned up when
 * the associated state instance is destroyed.
 */
export const on: AddEventListener = (
  target: EventTarget,
  event: string,
  callback: (event: any) => any,
  options?: boolean | AddEventListenerOptions
) => {
  EffectScope.current.add(() => {
    target.addEventListener(event, callback, options)
    return () => {
      target.removeEventListener(event, callback, options)
    }
  })
}
