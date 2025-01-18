import { createClass } from 'valtio-kit'

export const Test = createClass(() => {
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
