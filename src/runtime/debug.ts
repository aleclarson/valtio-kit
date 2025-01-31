import { isArray, isFunction, isIntString, isString, isSymbol } from 'radashi'
import { INTERNAL_Op, unstable_getInternalStates } from 'valtio/vanilla'
import { isAtom } from './atom'
import { ReactiveInstance } from './instance'

/** Pass this in your `pathFilter` to match any parts before, between, or after your filter. */
export const wild = Symbol('valtio-kit/debug/wild')

type Arrayable<T> = T | readonly T[]

export type ValtioFilter = {
  /**
   * Only log events for target objects with an `id` property or debug ID that
   * matches this filter. Pass a string for an exact match, or a RegExp for a
   * regex match.
   */
  targetFilter?: string | RegExp | ((baseObject: object) => boolean)
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

const { proxyCache } = unstable_getInternalStates()

declare module globalThis {
  let valtioHook: ((event: string, ...args: unknown[]) => void) | undefined
}

export type ValtioTargetKind = 'variable' | 'instance' | 'proxy'

export type ValtioUpdate = {
  targetId: string
  target: object
  targetKind: ValtioTargetKind
  path: readonly (string | symbol)[]
  op: 'set' | 'delete'
  value: unknown
  oldValue: unknown
}

// These types are not given an auto-generated debug ID.
const unIdentifiedTypes: Function[] = [Array, Map, Set, Object]

export function inspectValtio({
  filters,
  onUpdate = logUpdate,
  includeDroppedUpdates,
}: {
  filters?: ValtioFilter[]
  onUpdate?: (event: ValtioUpdate) => void
  /**
   * Include updates that are not subscribed to.
   */
  includeDroppedUpdates?: boolean
} = {}) {
  globalThis.valtioHook = (event, ...args) => {
    if (event === 'notifyUpdate') {
      let [baseObject, [op, path, value, oldValue], listeners] = args as [
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

      const proxyObject: any = proxyCache.get(baseObject)

      let targetId = proxyObject[kDebugId]
      if (!targetId) {
        if (
          isAtom(proxyObject) ||
          unIdentifiedTypes.includes(baseObject.constructor)
        ) {
          return // Ignore certain unidentified proxies.
        }
        setDebugId(proxyObject)
        targetId = proxyObject[kDebugId]
      }

      const context = proxyObject[kDebugContext]
      if (context) {
        setDebugId(context)
        targetId = `${context[kDebugId]}.#${targetId}`
      }

      const targetKind = isAtom(proxyObject)
        ? 'variable'
        : baseObject instanceof ReactiveInstance
          ? 'instance'
          : 'proxy'

      if (filters) {
        let shouldLog = false

        nextFilter: for (const { targetFilter, pathFilter } of filters) {
          // Do we care about the object being updated?
          if (targetFilter) {
            if (isFunction(targetFilter)) {
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

            nextPathFilter: for (const part of pathFilter) {
              if (part === wild) {
                wildPreceding = true
                continue nextPathFilter
              }
              while (pathIndex < path.length) {
                if (filterPropertyKey(path[pathIndex], part)) {
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

          // The filter passed, so we should log the event.
          shouldLog = true
        }

        // If we didn't find a match, skip this event.
        if (!shouldLog) {
          return
        }
      }

      onUpdate({
        targetId,
        target: baseObject,
        targetKind,
        path,
        op,
        value,
        oldValue,
      })
    }
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

function logUpdate(event: ValtioUpdate) {
  let { target, path, value, oldValue } = event
  let data: any

  const proxyObject = proxyCache.get(event.target)
  if (isAtom(proxyObject)) {
    path = path.slice(1) // Remove `.value` part
    data = event.op === 'set' ? value : oldValue
  } else {
    data = event.op === 'set' ? { target, value } : { target, oldValue }
  }

  console.log(
    '%s %s %O',
    event.op.toUpperCase(),
    event.targetId + toPathString(path),
    data
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
