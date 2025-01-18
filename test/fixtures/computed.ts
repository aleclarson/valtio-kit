import { createClass, proxy } from 'valtio-kit'

export const Test = createClass(options => {
  options = proxy(options)
  const a = {
    b: computed(() => options.b),
    c: 0,
  }
  a.c = computed(() => options.c)
  const d = computed(() => a.b + a.c)
  return {
    a,
    d,
  }
})
