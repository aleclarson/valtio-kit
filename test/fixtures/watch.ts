export const Counter = createState(() => {
  let a = 0
  const b = { c: { d: 1 } }

  watch(() => {
    a // primitive reference
    a++ // update expression
    a = 1 // assignment expression

    b.c.d // property access
    b.c.d = 2 // assignment expression

    // should not be transformed
    let innerVar = 1
  })

  return {}
})
