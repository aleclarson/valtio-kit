import { createClass } from 'valtio-kit'

export const Test = createClass(() => {
  const obj = { a: 0 }
  let value = 0

  // Case 1: A while loop without a block.
  // Case 2: A computed assignment inside a while loop.
  while (value === 0) obj.a = computed(() => value + 1)

  // Case 3: A while loop with a block.
  while (value < 10) {
    subscribe(obj.a, () => {})

    // Case 4: A nested while loop.
    while (value < 5) {
      subscribe(obj.a, () => {})
    }
  }

  return {
    increment() {
      value++
    },
  }
})
