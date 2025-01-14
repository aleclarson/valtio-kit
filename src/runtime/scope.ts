import type { Cleanup } from './effects'
import type { ReactiveClass } from './instance'

let activeScope: EffectScope | null = null

export class EffectScope {
  setupEffects: (() => Cleanup)[] | undefined
  updateEffects: ((...args: any[]) => void)[] | undefined
  cleanupEffects: Cleanup[] | undefined

  enter() {
    activeScope = this
  }
  leave() {
    activeScope = null
  }

  setup() {
    this.cleanupEffects = this.setupEffects?.map(setup => setup())
  }
  cleanup() {
    this.cleanupEffects?.forEach(cleanup => cleanup())
    this.cleanupEffects = undefined
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
