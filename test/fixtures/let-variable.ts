export const Counter = createClass(() => {
  let a = 0
  let b = {
    c: 0,
    d: 0,
    // Nested objects/arrays are not wrapped with $proxy, but they will still be
    // deeply reactive.
    nestedObject: {},
    nestedArray: [],
  }
  let c = []

  // These still use $proxyMap or $proxySet, because $atom doesn't affect maps
  // and sets.
  let d = new Map()
  let e = new Set()

  // Since this variable is never re-assigned, it won't be wrapped with $atom.
  let f = () => {
    a++
    // None of these objects/arrays are wrapped with $proxy, because the `b`
    // variable was wrapped with $atom.
    b = { c: 1, d: 1, nestedObject: {}, nestedArray: [] }
    b.c++
    b.d = 1
    b.d
    c = [1]
    c.push(2)
    d = new Map()
    d.set(1, 1)
    e = new Set()
    e.add(1)

    let nestedVar = 0
    nestedVar++
  }

  // These are never re-assigned, so they won't be wrapped with $atom.
  let a2 = 0
  let b2 = {}
  let c2 = []
  let d2 = new Map()
  let e2 = new Set()

  return {
    f,
    a2,
    b2,
    c2,
    d2,
    e2,
  }
})
