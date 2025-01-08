export const Counter = createState(() => {
  let count = 0

  watch(() => {
    count // primitive reference
    count++ // update expression
    count = 1 // assignment expression

    // should not be transformed
    let innerVar = 1
  })

  return {}
})
