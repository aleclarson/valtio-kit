import { createClass } from 'valtio-kit'

export const Test = createClass(() => {
  const a = 0
  const b = {}
  const c = []
  const d = new Map()
  const e = new Set()
  const f = () => {
    const nestedConst = { a: 1 }
    nestedConst.a++
  }

  return {}
})
