import { Cleanup } from './effects'

let activeScope: EffectScope | null = null

const scopes = new WeakMap<object, EffectScope>()

export class EffectScope {
  constructors: ((scope: EffectScope) => Cleanup)[] = []
  destructors: Cleanup[] = []

  add(constructor: (scope: EffectScope) => Cleanup) {
    this.constructors.push(constructor)
  }

  activate() {
    activeScope = this
  }
  deactivate() {
    activeScope = null
  }

  mount() {
    this.constructors.forEach(fn => this.destructors.push(fn(this)))
  }
  unmount() {
    this.destructors.forEach(fn => fn())
    this.destructors.length = 0
  }

  static get current() {
    return activeScope!
  }

  static get(object: object) {
    return scopes.get(object)
  }

  static set(object: object, scope: EffectScope) {
    scopes.set(object, scope)
  }
}
