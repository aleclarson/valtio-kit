import * as runtime from './dist/runtime'

declare global {
  const createState: typeof runtime.createState
  const watch: typeof runtime.watch
  const onMount: typeof runtime.onMount
  const subscribe: typeof runtime.subscribe
  const subscribeKey: typeof runtime.subscribeKey
  const addEventListener: typeof runtime.addEventListener
}

export {}
