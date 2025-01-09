export const Counter = createClass(() => {
  let a = 0
  const b = { c: 1 }

  subscribe(a, () => {
    console.log('a changed to', a)
  })

  subscribe(b, () => {
    console.log('b changed to', b)
  })

  return {}
})
