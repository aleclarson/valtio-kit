export const Counter = createClass(() => {
  let a = 0
  const b = { c: { d: 1 } }
  let array = []
  let map = new Map()

  watch(() => {
    a // primitive reference
    a++ // update expression
    a = 1 // assignment expression

    b.c.d // property access
    b.c.d = 2 // assignment expression

    array = [2] // set array variable
    map = new Map() // set Map variable

    // should not be transformed
    let innerVar = 1
  })

  return {}
})
