export {
  getVersion,
  ref,
  snapshot,
  type INTERNAL_Op,
  type Snapshot,
} from 'valtio/vanilla'
export { computed } from './runtime/computed'
export {
  addClassExtension,
  createClass,
  type ReactiveClass,
} from './runtime/createClass'
export {
  on,
  onMount,
  onUpdate,
  subscribe,
  subscribeKey,
  watch,
  type Cleanup,
} from './runtime/effects'
export { createEventTarget, EventTarget } from './runtime/eventTarget'
export {
  ReactiveInstance,
  type InstanceFactory,
  type ReactiveProxy,
} from './runtime/instance'
export { proxy } from './runtime/proxy'
