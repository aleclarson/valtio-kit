import { isArray, isString, isSymbol } from 'radashi'
import {
  ValtioCall,
  ValtioEvent,
  ValtioTargetKind,
  ValtioUpdate,
} from './event'

/** Pass this in your `pathFilter` to match any parts before, between, or after your filter. */
export const wild = Symbol('valtio-kit/debug/wild')

type Arrayable<T> = T | readonly T[]

type PathFilter = {
  /**
   * Only log events that affect a property path that matches this filter.
   *
   * Pass a string or symbol for an exact match, or a RegExp for a regex match.
   * An array of these will act as a logical OR.
   *
   * Pass the `wild` symbol (exported by `valtio-kit/debug`) to match any parts
   * before, between, or after your filter.
   */
  pathFilter: readonly (typeof wild | Arrayable<string | symbol | RegExp>)[]
}

type MethodFilter = {
  /**
   * Only log calls to methods with a name that matches this filter.
   *
   * Note: This option implies `logMethodCalls: true` for this filter.
   */
  methodFilter: string | RegExp
}

type TargetFilter = {
  /**
   * Only log events for target objects with an `id` property or debug ID that
   * matches this filter. Pass a string for an exact match, or a RegExp for a
   * regex match.
   */
  targetFilter: string | RegExp | ((baseObject: object) => boolean)
}

type TargetKindFilter = {
  /**
   * When defined, only log events for target objects with a target kind that
   * matches one of these values.
   */
  targetKindFilter: Arrayable<ValtioTargetKind>
}

type MatchHandler<Event extends ValtioEvent> = {
  /**
   * Called when an event matches this filter. A great place to put a
   * `debugger` statement.
   */
  onMatch?: (event: Event) => void
}

type StrictFilter =
  | (PathFilter &
      Partial<TargetFilter & TargetKindFilter> &
      MatchHandler<ValtioUpdate>)
  | (MethodFilter &
      Partial<TargetFilter & TargetKindFilter> &
      MatchHandler<ValtioCall>)
  | (TargetFilter &
      Partial<TargetKindFilter & (PathFilter | MethodFilter)> &
      MatchHandler<ValtioUpdate | ValtioCall>)
  | (TargetKindFilter &
      Partial<TargetFilter & (PathFilter | MethodFilter)> &
      MatchHandler<ValtioUpdate | ValtioCall>)

type LooseFilter = Partial<
  TargetFilter &
    TargetKindFilter &
    PathFilter &
    MethodFilter &
    MatchHandler<ValtioUpdate | ValtioCall>
>

type FilterEffects = {
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
}

export type ValtioFilter = StrictFilter & FilterEffects

export type AnyValtioFilter = LooseFilter & FilterEffects

export function filterPropertyKey(
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
