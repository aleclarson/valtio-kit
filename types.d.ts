import { Context } from 'react'

declare global {
  const createState: <TArgs extends any[], TReturn extends object>(
    fn: (...args: TArgs) => TReturn
  ) => {
    /** Create an instance of this state hook. */
    (...args: TArgs): Readonly<TReturn>

    /** Get the current state from the nearest context provider. */
    (): Readonly<TReturn>

    /** Create a context provider for this state hook. */
    createContext: () => Context<TReturn>
  }
}
