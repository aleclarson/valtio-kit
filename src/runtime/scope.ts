import type { Cleanup } from './effects'
import type { ReactiveClass } from './instance'

let activeScope: EffectScope | null = null

export class EffectScope {
  parentScope: EffectScope | undefined
  setupEffects: (() => Cleanup)[] | undefined
  updateEffects: ((...args: any[]) => void)[] | undefined
  cleanupEffects: Cleanup[] | undefined

  enter() {
    if (activeScope) {
      this.parentScope = activeScope
    }
    activeScope = this
  }
  leave() {
    activeScope = this.parentScope ?? null
  }

  setup() {
    this.cleanupEffects = this.setupEffects?.map(setup => setup())
  }
  cleanup() {
    this.cleanupEffects?.forEach(cleanup => cleanup())
    this.cleanupEffects = undefined
  }

  autoSetup() {
    if (activeScope) {
      EffectScope.addSetupEffect(() => {
        this.setup()
        return () => this.cleanup()
      })
    } else if (allowAutoSetup()) {
      this.setup()
    }
  }

  static readonly symbol = Symbol.for('valtio-kit.scope')

  static addSetupEffect(effect: () => Cleanup) {
    activeScope!.setupEffects ||= []
    activeScope!.setupEffects.push(effect)
  }

  static addUpdateEffect<TClass extends ReactiveClass<any>>(
    effect: (...args: ConstructorParameters<TClass>) => void
  ) {
    activeScope!.updateEffects ||= []
    activeScope!.updateEffects.push(effect)
  }
}

let allowAutoSetup = () => true
export function setAllowAutoSetup(fn: () => boolean) {
  allowAutoSetup = fn
}
