import type { ReactiveClass } from './createClass'
import type { Cleanup } from './effects'

let currentScope: EffectScope | undefined

export class EffectScope {
  parentScope = currentScope
  setupSelf: (() => Cleanup) | undefined
  setupEffects: (() => Cleanup)[] | undefined
  updateEffects: ((...args: any[]) => void)[] | undefined
  cleanupEffects: Cleanup[] | undefined

  run<T>(callback: () => T) {
    const callerScope = currentScope
    currentScope = this
    try {
      return callback()
    } finally {
      currentScope = callerScope
    }
  }
  setup() {
    this.cleanupEffects = this.setupEffects?.map(setup => setup())
  }
  cleanup() {
    this.cleanupEffects?.forEach(cleanup => cleanup())
    this.cleanupEffects = undefined
  }

  /**
   * Allow the scope to setup its effects when appropriate.
   *
   * If a parent scope exists, wait for it to be setup.
   */
  autoSetup() {
    const { parentScope } = this
    if (parentScope) {
      this.setupSelf = () => {
        this.setup()
        return () => this.cleanup()
      }
      parentScope.setupEffects ||= []
      parentScope.setupEffects.push(this.setupSelf)
      parentScope.cleanupEffects?.push(this.setupSelf())
    } else if (allowAutoSetup()) {
      this.setup()
    }
  }

  /**
   * Force the scope to cleanup its effects. The functional opposite of
   * `autoSetup`.
   *
   * If a parent scope exists, decouple this scope from it.
   */
  autoCleanup() {
    this.cleanup()

    if (this.setupSelf) {
      const parentScope = this.parentScope!
      const index = parentScope.setupEffects!.indexOf(this.setupSelf)
      if (index !== -1) {
        parentScope.setupEffects!.splice(index, 1)
        parentScope.cleanupEffects?.splice(index, 1)
      }
    }
  }

  static readonly symbol = Symbol.for('valtio-kit.scope')

  static addSetupEffect(effect: () => Cleanup) {
    currentScope!.setupEffects ||= []
    currentScope!.setupEffects.push(effect)
  }

  static addUpdateEffect<TClass extends ReactiveClass<any>>(
    effect: (...args: ConstructorParameters<TClass>) => void
  ) {
    currentScope!.updateEffects ||= []
    currentScope!.updateEffects.push(effect)
  }

  static run(callback: () => void) {
    const scope = new EffectScope()
    scope.run(callback)
    return scope
  }
}

let allowAutoSetup = () => true
export function setAllowAutoSetup(fn: () => boolean) {
  allowAutoSetup = fn
}
