import { createClass } from 'valtio-kit'

// Array pattern assignment
export const Test1 = createClass((a: string, b: number = 0) => {
  onUpdate<typeof Test1>((...args) => ([a] = args))
  return {}
})

// Object pattern assignment
export const Test2 = createClass(({ a, b = 0 }: { a: string; b: number }) => {
  onUpdate<typeof Test2>((...args) => ({ a } = args[0]))
  return {}
})

// Basic assignment
export const Test3 = createClass((a: string, b: number = 0) => {
  onUpdate<typeof Test3>((...args) => {
    a = args[0]
  })
  return {}
})
