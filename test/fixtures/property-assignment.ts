import { createClass, proxy } from 'valtio-kit'

class Thing {
  foo = 1

  constructor(readonly options?: object) {
    return proxy(this)
  }
}

export const Test = createClass(() => {
  // Notably, this shouldn't be transformed at all. Even though the `Thing`
  // class returns a reactive instance, the compiler has no hint of that.
  // Therefore, accessing properties of `thing` won't be observable. To fix
  // this, you have to wrap the `new` expression with `proxy(…)`.
  const thing = new Thing({})

  // Wrapping with `proxy(…)` hints to the compiler that `thing2` is reactive.
  const thing2 = proxy(new Thing({}))

  // This will be wrapped with `proxy(…)` by the compiler, because the `b`
  // property is assigned to in another function scope.
  const obj = { b: 0 }

  // This will also be wrapped, even though the only property assignment happens
  // in the root scope. This behavior may change in the future.
  const obj2 = { x: 0 }
  obj2.x++

  return {
    thing,
    doSomething() {
      thing.foo = 2
      obj.b++
    },
    // Expect `thing.foo` to not be observed.
    blah: computed(() => thing.foo + thing2.foo + obj.b),
  }
})
