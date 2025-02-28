import { createClass, proxy } from 'valtio-kit'
import { setDebugId } from 'valtio-kit/debug'

class Thing {
  constructor() {
    return proxy(this)
  }
}

export const Test = createClass(() => {
  const thing = new Thing()
  setDebugId(thing, 'thing')

  // This won't be transformed, since the debug ID will use the Thing
  // constructor.
  setDebugId(thing)

  return {
    thing,
  }
})
