import { Cleanup } from './effects'

let activeScope: EffectScope | null = null

export class EffectScope {
  constructors: ((scope: EffectScope) => void)[] = []
  destructors: Cleanup[] = []

  activate() {
    activeScope = this
  }
  deactivate() {
    activeScope = null
  }

  mount() {
    this.constructors.forEach(fn => fn(this))
  }
  unmount() {
    this.destructors.forEach(fn => fn())
    this.destructors.length = 0
  }

  static get current() {
    return activeScope!
  }
}
