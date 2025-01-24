import { isBoolean } from 'radashi'

const kEventTypes = Symbol.for('valtio-kit.eventTypes')

export function createEventTarget<TEvents extends object>() {
  type EventArgs<TEventKey extends keyof TEvents> = Extract<
    TEvents[TEventKey],
    readonly any[]
  >
  type EventListener<TEventKey extends keyof TEvents> = (
    ...args: EventArgs<TEventKey>
  ) => any
  type EventListenerOptions = {
    once?: boolean
    signal?: AbortSignal
  }
  type AbortHandler = (this: AbortSignal, ev: Event) => any
  type EventListenerState = {
    listeners: Set<EventListener<any>>
    optionsMap: WeakMap<
      EventListener<any>,
      EventListenerOptions & { abortHandler?: AbortHandler }
    >
  }

  const listenerState = new Map<keyof TEvents, EventListenerState>()

  function addEventListener<TEventKey extends keyof TEvents>(
    key: TEventKey,
    listener: EventListener<TEventKey>,
    options?: boolean | EventListenerOptions
  ) {
    if (isBoolean(options)) {
      throw new Error('Event capturing is not supported')
    }

    let state = listenerState.get(key)
    if (!state) {
      state = {
        listeners: new Set(),
        optionsMap: new WeakMap(),
      }
      listenerState.set(key, state)
    }

    options = { ...options }
    options.signal?.addEventListener(
      'abort',
      ((options as { abortHandler: AbortHandler }).abortHandler = () =>
        removeEventListener(key, listener))
    )

    state.listeners.add(listener)
    state.optionsMap.set(listener, options)
  }

  function removeEventListener<TEventKey extends keyof TEvents>(
    key: TEventKey,
    listener: EventListener<TEventKey>,
    options?: boolean | EventListenerOptions
  ) {
    const state = listenerState.get(key)
    if (state) {
      const options = state.optionsMap.get(listener)!
      options.signal?.removeEventListener('abort', options.abortHandler!)

      state.listeners.delete(listener)
      state.optionsMap.delete(listener)
    }
  }

  function emit<TEventKey extends keyof TEvents>(
    key: TEventKey,
    ...args: EventArgs<TEventKey>
  ) {
    const state = listenerState.get(key)
    if (state) {
      const { listeners, optionsMap } = state
      listeners.forEach(listener => {
        if (optionsMap.get(listener)?.once) {
          removeEventListener(key, listener)
        }
        listener(...args)
      })
    }
  }

  return [
    { addEventListener, removeEventListener } as EventTarget<TEvents>,
    emit,
  ] as const
}

export interface EventTarget<TEvents extends object> {
  [kEventTypes]?: TEvents

  /**
   * Add an event listener.
   *
   * You should use valtio-kit's `on(…)` utility when inside a `createClass`
   * factory function, instead of this method.
   */
  addEventListener: <TEventKey extends InferEventType<TEvents>>(
    key: TEventKey,
    listener: (...args: InferCallbackArgs<TEvents, TEventKey>) => void,
    options?: boolean | AddEventListenerOptions
  ) => void

  /**
   * Remove an event listener.
   *
   * Note that the only option used in identifying which listener to remove is
   * the `capture` option (which may be a boolean argument or wrapped in the
   * `options` object argument).
   */
  removeEventListener: <TEventKey extends InferEventType<TEvents>>(
    key: TEventKey,
    listener: (...args: InferCallbackArgs<TEvents, TEventKey>) => void,
    options?: boolean | AddEventListenerOptions
  ) => void
}

type InferEventType<TEvents extends object> = object extends TEvents
  ? string
  : keyof TEvents

type InferCallbackArgs<
  TEvents extends object,
  TEventKey extends InferEventType<TEvents>,
> = object extends TEvents
  ? [Event]
  : Extract<TEvents[TEventKey & keyof TEvents], any[]>
