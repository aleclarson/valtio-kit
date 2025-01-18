import { createClass } from 'valtio-kit'

export const Test = createClass(() => {
  let a = 0
  const b = { a }

  return {
    a,
    b,
    c: {
      a,
      b,
      get d() {
        return 1
      },
      array: [a, b],
    },
    get d() {
      return 2
    },
    array: [a, b],
    staticObject: { a: 1 },
    foo() {
      a++
    },
  }
})
