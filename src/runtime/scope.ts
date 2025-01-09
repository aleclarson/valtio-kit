import { Cleanup } from './effects'

let activeScope: EffectScope | null = null

const scopes = new WeakMap<object, EffectScope>()

export class EffectScope {
  constructors: (() => Cleanup)[] = []
  destructors: Cleanup[] = []

  enter() {
    activeScope = this
  }
  leave() {
    activeScope = null
  }

  static assign(object: object, scope: EffectScope) {
    scopes.set(object, scope)
  }

  static schedule(constructor: () => Cleanup) {
    activeScope!.constructors.push(constructor)
  }

  static retain(object: object) {
    const scope = scopes.get(object)
    scope?.constructors.forEach(setup => scope.destructors.push(setup()))
  }

  static release(object: object) {
    const scope = scopes.get(object)
    if (scope) {
      scope.destructors.forEach(fn => fn())
      scope.destructors.length = 0
    }
  }
}
