import {
  castArray,
  isArray,
  isFunction,
  isIntString,
  isString,
  isSymbol,
  last,
} from 'radashi'
import {
  INTERNAL_Op,
  snapshot,
  unstable_getInternalStates,
} from 'valtio/vanilla'
import { isAtom } from './atom'
import { ReactiveInstance } from './instance'

/** Pass this in your `pathFilter` to match any parts before, between, or after your filter. */
export const wild = Symbol('valtio-kit/debug/wild')

type Arrayable<T> = T | readonly T[]

export type ValtioFilter = {
  /**
   * When true, this filter will exclude matches from being logged.
   */
  exclude?: boolean
  /**
   * When true, any event matching this filter will be logged with the
   * `console.trace` method.
   */
  trace?: boolean
  /**
   * When true, any time a method is called on a proxy object matching this
   * filter, the event will be logged.
   */
  logMethodCalls?: boolean
  /**
   * Only log events for target objects with an `id` property or debug ID that
   * matches this filter. Pass a string for an exact match, or a RegExp for a
   * regex match.
   */
  targetFilter?: string | RegExp | ((baseObject: object) => boolean)
  /**
   * When defined, only log events for target objects with a target kind that
   * matches one of these values.
   */
  targetKindFilter?: Arrayable<ValtioTargetKind>
  /**
   * Only log events that affect a property path that matches this filter.
   *
   * Pass a string or symbol for an exact match, or a RegExp for a regex match.
   * An array of these will act as a logical OR.
   *
   * Pass the `wild` symbol (exported by `valtio-kit/debug`) to match any parts
   * before, between, or after your filter.
   */
  pathFilter?: readonly (typeof wild | Arrayable<string | symbol | RegExp>)[]
  /**
   * Only log calls to methods with a name that matches this filter.
   *
   * Note: This option implies `logMethodCalls: true` for this filter.
   */
  methodFilter?: string | RegExp
}

/** Symbol used to store a debug ID on a proxy object. */
export const kDebugId = Symbol('valtio-kit/debug/id')
/** Symbol used to store a debug context on a proxy object. */
export const kDebugContext = Symbol('valtio-kit/debug/context')

const nextInstanceId: Record<string, number> = {}

/**
 * You can set a manual debug ID on a target object, or it will be generated
 * automatically. Arrays, maps, and sets don't have a debug ID unless you set
 * one manually.
 */
export function setDebugId(target: object, debugId?: string) {
  if (!debugId) {
    if (Object.prototype.hasOwnProperty.call(target, kDebugId)) {
      return
    }
    const className = target.constructor.name
    if ('id' in target && isString(target.id)) {
      debugId = `${className}(${target.id})`
    } else {
      const instanceId = nextInstanceId[className] ?? 1
      nextInstanceId[className] = instanceId + 1
      debugId = `${className}(${instanceId})`
    }
  }
  Object.defineProperty(target, kDebugId, {
    value: debugId,
    configurable: true,
  })
}

const { proxyCache, proxyStateMap } = unstable_getInternalStates()

declare module globalThis {
  let valtioHook: ((event: string, ...args: unknown[]) => void) | undefined
}

export type ValtioTargetKind = 'variable' | 'instance' | 'proxy'

export type ValtioEvent = {
  targetId: string
  target: object
  targetKind: ValtioTargetKind
  path: readonly (string | symbol)[]
}

export type ValtioUpdate = ValtioEvent & {
  op: 'set' | 'delete'
  value: unknown
  oldValue: unknown
}

export type ValtioCall = ValtioEvent & {
  method: string
  args: unknown[]
}

// These types are not given an auto-generated debug ID.
const unIdentifiedTypes: Function[] = [Array, Map, Set, Object]

type Options = {
  filters?: ValtioFilter[]
  onUpdate?: (event: ValtioUpdate, options: Options) => void
  /**
   * If defined, array updates caused by native method calls will be coalesced
   * into a single event, which is handled by this callback.
   */
  onCall?: (event: ValtioCall, options: Options) => void
  /**
   * Instruct the default logger to snapshot the target object before logging it
   * to the console.
   *
   * Without this option, logged targets may not reflect their state at the time
   * of the update (when inspecting them in the console).
   *
   * It's disabled by default, for performance reasons.
   */
  logTargetSnapshots?: boolean
  /**
   * Include updates that are not subscribed to.
   */
  includeDroppedUpdates?: boolean
  /**
   * When true, every event not filtered out will be logged with the
   * `console.trace` method.
   *
   * You can override this by setting `trace` to either true/false on a specific
   * filter.
   */
  trace?: boolean
  /**
   * When true, any methods called from a proxy are logged.
   *
   * You can override this by setting `logMethodCalls` to either true/false on a
   * specific filter.
   */
  logMethodCalls?: boolean
}

export function inspectValtio(options: Options = {}) {
  const {
    filters,
    onUpdate = logUpdate,
    onCall = !('onCall' in options || 'onUpdate' in options)
      ? logCall
      : undefined,
    includeDroppedUpdates,
  } = options

  // Track method calls to coalesce set/delete operations for arrays.
  const callStacks = new WeakMap<object, CallStack>()

  globalThis.valtioHook = (event, ...payload) => {
    if (event === 'update') {
      let [baseObject, [op, path, value, oldValue], listeners] = payload as [
        object,
        INTERNAL_Op,
        Set<Function>,
      ]

      if (!listeners.size && !includeDroppedUpdates) {
        return // Nothing is subscribed to this update.
      }

      if (isAtom(oldValue) && !isAtom(value)) {
        return // Initializing a variable or property binding.
      }

      if (op === 'delete') {
        oldValue = value
        value = undefined
      }

      const event = resolveEventInfo(
        'update',
        baseObject,
        path,
        options,
        filters
      )
      if (!event) {
        return
      }

      if (onCall) {
        const leafObject =
          path.length > 1 ? resolveLeafObject(baseObject, path) : baseObject

        // When a native array method is called, we want to coalesce the updates
        // into a single event.
        if (isArray(leafObject) && callStacks.has(leafObject)) {
          const call = last(callStacks.get(leafObject)!)!
          if (
            call.seen ||
            call.method !== Array.prototype[call.method.name as keyof any[]]
          ) {
            return
          }
          call.seen = true
          return onCall(
            {
              targetId: event.targetId,
              target: baseObject,
              targetKind: event.targetKind,
              // The path of an array update always ends with either an index or
              // the "length" key. Since we're logging a native Array method
              // call, it's better to omit them from the path.
              path: event.resolvedPath.slice(0, -1),
              method: call.method.name,
              args: call.args,
            },
            event.resolvedOptions
          )
        }
      }

      onUpdate(
        {
          targetId: event.targetId,
          target: baseObject,
          targetKind: event.targetKind,
          path: event.resolvedPath,
          op,
          value,
          oldValue,
        },
        event.resolvedOptions
      )
    } else if (event === 'call') {
      let [method, baseObject, args] = payload as [Function, object, unknown[]]
      const callStack = callStacks.get(baseObject) ?? []
      callStack.push({ method, args, seen: false })
      callStacks.set(baseObject, callStack)
      if (onCall && !isArray(baseObject)) {
        const event = resolveEventInfo(
          'call',
          baseObject,
          [method.name],
          options,
          filters
        )
        return (
          event &&
          onCall(
            {
              targetId: event.targetId,
              target: baseObject,
              targetKind: event.targetKind,
              path: [method.name],
              method: 'call',
              args,
            },
            event.resolvedOptions
          )
        )
      }
    } else if (event === 'return') {
      let [, baseObject] = payload as [Function, object, unknown[]]
      const callStack = callStacks.get(baseObject)!
      // Assume this "return" event is for the last call.
      callStack.pop()
      if (callStack.length === 0) {
        callStacks.delete(baseObject)
      }
    }
  }
}

type CallStack = {
  method: Function
  args: unknown[]
  seen: boolean
}[]

function resolveEventInfo(
  type: 'update' | 'call',
  baseObject: object,
  path: readonly (string | symbol)[],
  options: Options,
  filters: ValtioFilter[] | undefined
) {
  const proxyObject: any = proxyCache.get(baseObject)

  let targetId = proxyObject[kDebugId] as string | undefined
  if (!targetId) {
    if (
      isAtom(proxyObject) ||
      unIdentifiedTypes.includes(baseObject.constructor)
    ) {
      return // Ignore certain unidentified proxies.
    }
    setDebugId(proxyObject)
    targetId = proxyObject[kDebugId] as string
  }

  const context: any = proxyObject[kDebugContext]
  if (context) {
    // When a debug context exists, we know this is a reactive variable being
    // updated. Slice out the `.value` part from the path and prepend the
    // variable's name (prefixed with `#` to indicate a private name).
    path = ['#' + targetId, ...path.slice(1)]

    // Reset the target ID to the debug ID of the context. This allows a filter
    // to easily match anything related to a reactive instance (including public
    // properties, method calls, and private variables).
    setDebugId(context)
    targetId = context[kDebugId] as string
  }

  const targetKind: ValtioTargetKind = isAtom(proxyObject)
    ? 'variable'
    : baseObject instanceof ReactiveInstance
      ? 'instance'
      : 'proxy'

  let { trace, logMethodCalls } = options

  if (filters) {
    // If only exclusion filters are provided, we must assume an event
    // should be logged unless explicitly excluded. Otherwise, we'll assume
    // an event should *not* be logged unless explicitly included.
    let shouldLog = filters.every(filter => filter.exclude)

    nextFilter: for (const {
      targetFilter,
      targetKindFilter,
      pathFilter,
      methodFilter,
      ...filter
    } of filters) {
      // Do we care about the object being updated?
      if (
        targetKindFilter &&
        !castArray(targetKindFilter).includes(targetKind)
      ) {
        continue nextFilter
      }
      if (targetFilter) {
        if (isFunction(targetFilter)) {
          if (targetKind === 'variable') continue
          if (!targetFilter(baseObject)) continue
        } else if (isString(targetFilter)) {
          if (targetId !== targetFilter) continue
        } else if (targetFilter instanceof RegExp) {
          if (!targetFilter.test(targetId)) continue
        }
      }

      if (pathFilter) {
        let pathIndex = 0
        let wildPreceding = false

        nextPathFilter: for (const keyFilter of pathFilter) {
          if (keyFilter === wild) {
            wildPreceding = true
            continue nextPathFilter
          }
          while (pathIndex < path.length) {
            if (filterPropertyKey(path[pathIndex], keyFilter)) {
              // Consume the wildcard if we found a match.
              wildPreceding = false
              pathIndex++
              continue nextPathFilter
            }
            // No match and no wildcard, so skip this filter.
            if (!wildPreceding) {
              continue nextFilter
            }
            pathIndex++
          }
          // We reached the end without finding a match.
          if (pathIndex === path.length) {
            continue nextFilter
          }
        }
      }

      if (methodFilter) {
        if (type !== 'call') {
          continue nextFilter
        }
        const methodName = path[0] as string
        if (isString(methodFilter)) {
          if (methodName !== methodFilter) continue
        } else if (methodFilter instanceof RegExp) {
          if (!methodFilter.test(methodName)) continue
        }
        logMethodCalls = true
      }

      if (filter.trace !== undefined) {
        trace = filter.trace
      }
      if (filter.logMethodCalls !== undefined) {
        logMethodCalls = filter.logMethodCalls
      }

      // By this point, we know the filter was a match. Depending on the
      // `exclude` filter option, we either log or skip the event.
      shouldLog = !filter.exclude
      break
    }

    // If we didn't find a match, skip this event.
    if (!shouldLog) {
      return null
    }
  }

  if (!logMethodCalls && type === 'call') {
    return null
  }

  const resolvedOptions =
    trace !== options.trace || logMethodCalls !== options.logMethodCalls
      ? { ...options, trace, logMethodCalls }
      : options

  return {
    targetId,
    targetKind,
    resolvedPath: path,
    resolvedOptions,
  }
}

function filterPropertyKey(
  key: string | symbol,
  filter: Arrayable<string | RegExp | symbol>
): boolean {
  if (isArray(filter)) {
    return filter.some(filter => filterPropertyKey(key, filter))
  }
  if (isString(filter) || isSymbol(filter)) {
    return key === filter
  }
  if (isString(key) && filter instanceof RegExp) {
    return filter.test(key)
  }
  return false
}

// The default onUpdate callback
function logUpdate(event: ValtioUpdate, options: Options) {
  let { target, path, value, oldValue } = event
  let data: any

  const proxyObject = proxyCache.get(event.target)
  if (isAtom(proxyObject)) {
    data = event.op === 'set' ? value : oldValue
  } else {
    if (options.logTargetSnapshots) {
      const targetProxy = proxyCache.get(target)
      if (targetProxy) {
        target = snapshot(targetProxy)
      }
    }
    data = event.op === 'set' ? { target, value } : { target, oldValue }
  }

  console[options.trace ? 'trace' : 'log'](
    '%s %s',
    event.op.toUpperCase(),
    event.targetId + toPathString(path),
    data
  )
}

// The default onCall callback (only used if onUpdate is logUpdate)
function logCall(event: ValtioCall, options: Options) {
  console[options.trace ? 'trace' : 'log'](
    '%s %s',
    event.method.toUpperCase(),
    event.targetId + toPathString(event.path),
    event.args
  )
}

function toPathString(path: readonly (string | symbol)[]) {
  let result = ''
  for (const part of path) {
    result +=
      isSymbol(part) || isIntString(part) ? `[${String(part)}]` : `.${part}`
  }
  return result
}

function resolveLeafObject(
  baseObject: any,
  path: readonly (string | symbol)[]
) {
  let leafObject = baseObject
  // Ignore the last part of the path.
  for (let i = 0; i < path.length - 1; i++) {
    leafObject = leafObject[path[i]]
  }
  const state = proxyStateMap.get(leafObject)
  return state?.[0] ?? leafObject
}
