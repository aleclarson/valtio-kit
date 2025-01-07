import {
  effect,
  effectScope,
  isReactive,
  isRef,
  isShallow,
  reactive,
  shallowReadonly,
  toRaw,
  track,
  TrackOpTypes,
} from '@vue/reactivity'
import { isPlainObject } from 'radashi'
import { Context, createContext, useContext, useEffect, useState } from 'react'

export function createState(create: Function) {
  let Context: Context<any> | null = null

  //  and automatically updates
  // the component upon an observable change.
  function subscribe(state: any) {
    const deps: Dep[] = []

    const forceUpdate = useState<any>()[1]
    useEffect(() => {
      let initialized = false

      const runner = effect(() => {
        for (const dep of deps) {
          dep.track()
        }
        console.log('effect', { initialized })
        if (initialized) {
          forceUpdate({})
        } else {
          initialized = true
        }
      })

      return () => {
        runner.effect.stop()
      }
    })

    return createProxy(state, deps)
  }

  // Create a proxy that collects dependencies. If a reactive object is
  // encountered, it will be recursively proxied. Arrays, maps, and sets are not
  // proxied.
  function createProxy(state: any, deps: Dep[]) {
    const shallow = isShallow(state)
    return new Proxy(state, {
      get(_, key) {
        if (key === rawStateKey) {
          return state
        }
        let value = state[key]
        if (shallow) {
          deps.push(new Dep(state, key))
        } else if (isRef(value)) {
          deps.push(new Dep(state, key))
          value = value.value
        }
        if (isPlainObject(value) && isReactive(value)) {
          return createProxy(value, deps)
        }
        return value
      },
    })
  }

  function hook(...args: any[]) {
    if (args.length === 0) {
      const instance = Context && useContext(Context)
      return instance && subscribe(instance[rawStateKey])
    }

    // Pass in the reactive args. The transformer will rewrite argument
    // references to use indexed access patterns, so reactivity is preserved.
    const [[state, scope, reactiveArgs]] = useState(() => {
      const reactiveArgs = reactive(args)
      const scope = effectScope()

      let state: any
      scope.run(() => {
        state = create(reactiveArgs)
      })

      return [shallowReadonly(state), scope, reactiveArgs] as const
    })

    // Update the args on each render.
    useEffect(() => {
      if (args !== toRaw(reactiveArgs)) {
        deepAssignArgs(reactiveArgs, args)
      }
    })

    // Dispose of persistent effects when the component unmounts.
    useEffect(() => scope.stop.bind(scope), [])

    return subscribe(state)
  }

  hook.createContext = () => {
    return createContext(null)
  }

  return hook
}

const rawStateKey = Symbol.for('vite-react-state:rawState')

class Dep {
  constructor(
    readonly target: object,
    readonly key: unknown
  ) {}

  track() {
    track(this.target, TrackOpTypes.GET, this.key)
  }
}

// Like deepAssign for an array of arguments.
function deepAssignArgs<T extends any[]>(a: T, b: T) {
  for (let i = 0; i < b.length; i++) {
    if (isPlainObject(b[i])) {
      if (isPlainObject(a[i])) {
        deepAssign(a[i], b[i])
      } else {
        a[i] = b[i]
      }
    } else {
      a[i] = b[i]
    }
  }
  a.length = b.length
  return a
}

// Plain objects are shallow-merged, except for nested plain objects, which are
// deeply merged.
function deepAssign<T extends object>(a: T, b: T) {
  for (const key in b) {
    if (isPlainObject(b[key])) {
      if (isPlainObject(a[key])) {
        deepAssign(a[key], b[key])
      } else {
        a[key] = b[key]
      }
    } else {
      a[key] = b[key]
    }
  }
  for (const key in a) {
    if (!(key in b)) {
      a[key] = undefined as any
    }
  }
}
