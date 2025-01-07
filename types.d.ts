import { Context } from 'react'

declare global {
  const createState: <T extends (...args: any[]) => object>(
    factory: T
  ) => {
    /** Create an instance of this state hook. */
    (...args: Parameters<T>): Readonly<ReturnType<T>>

    /** Get the current state from the nearest context provider. */
    (): Readonly<ReturnType<T>>

    /** Create a context provider for this state hook. */
    createContext: () => Context<Readonly<ReturnType<T>>>
  }
}
