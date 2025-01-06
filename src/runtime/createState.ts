import { effect, effectScope, isRef, reactive, toRaw } from '@vue/reactivity'
import { isPlainObject, proxied } from 'radashi'
import { Context, createContext, useContext, useEffect, useState } from 'react'

const rawStateKey = Symbol.for('vite-react-state:rawState')

export function createState(create: Function) {
  let Context: Context<any> | null = null

  // Create a proxy that tracks access to the state and automatically updates
  // the component upon an observable change.
  function subscribe(state: any) {
    const accessed = new Set<PropertyKey>()

    const forceUpdate = useState<any>()[1]
    useEffect(() => {
      let initialized = false

      const runner = effect(() => {
        for (const key of accessed) {
          state[key]
        }
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

    return proxied<PropertyKey, any>(key => {
      if (key === rawStateKey) {
        return state
      }
      const value = state[key]
      if (isRef(value)) {
        accessed.add(key)
        return value.value
      }
      return value
    })
  }

  function hook(...args: any[]) {
    if (args.length === 0) {
      const instance = Context && useContext(Context)
      return instance && subscribe(instance[rawStateKey])
    }

    const [prevArgs] = useState(() => reactive(args))

    // Update the args on each render.
    useEffect(() => {
      if (args !== toRaw(prevArgs)) {
        deepAssignArgs(prevArgs, args)
      }
    })

    // Pass in the reactive args. The transformer will rewrite argument
    // references to use indexed access patterns, so reactivity is preserved.
    const [[state, scope]] = useState(() => {
      let state: any
      const scope = effectScope()
      scope.run(() => {
        state = create(prevArgs)
      })
      return [reactive(state), scope] as const
    })

    // Dispose of persistent effects when the component unmounts.
    useEffect(() => () => scope.stop(), [])

    return subscribe(state)
  }

  hook.createContext = () => {
    return createContext(null)
  }

  return hook
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
