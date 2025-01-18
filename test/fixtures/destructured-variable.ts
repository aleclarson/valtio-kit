import { createClass } from 'valtio-kit'

export const Point2D = createClass(({ x, y }, options) => {
  const { rotation = 0 } = options
  let { scale = 1, origin = { x: 0, y: 0 } } = options
  let [foo, bar] = options.array

  return {
    rotation,
    moveX(distance: number) {
      x += distance
    },
    someCoolMethod() {
      foo = 1
      scale = 2
      origin.x = 3
    },
  }
})
