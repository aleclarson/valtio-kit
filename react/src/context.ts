import * as React from 'react'
import type { InstanceFactory, ReactiveClass, ReactiveProxy } from 'valtio-kit'
import { addClassExtension } from 'valtio-kit'

declare module 'valtio-kit' {
  export interface ReactiveClass<TFactory extends InstanceFactory> {
    Context: React.Context<ReactiveProxy<TFactory> | null>
    Provider: React.Provider<ReactiveProxy<TFactory> | null>
  }
}

addClassExtension(constructor => {
  const Context = React.createContext<any>(null)
  constructor.Context = Context
  constructor.Provider = Context.Provider
})

export function createContextHooks<TFactory extends InstanceFactory>({
  name,
  Context,
}: ReactiveClass<TFactory>) {
  const useContext = () => React.use(Context)
  const useContextOrThrow = () => {
    const context = React.use(Context)
    if (!context) {
      throw new Error(`${name} context not found`)
    }
    return context
  }
  return [useContext, useContextOrThrow] as const
}
