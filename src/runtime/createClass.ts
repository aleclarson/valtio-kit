import { isFunction } from 'radashi'
import { InstanceFactory, ReactiveInstance, ReactiveProxy } from './instance'
import { EffectScope } from './scope'
import { unnest } from './unnest'

declare const process: { env: Record<string, string | undefined> }

const classExtensions: ReactiveClass.Extension[] = []

/**
 * Creates a `class` that produces a reactive object. The given `factory`
 * function is transformed at compile time. The logic contained within is plain
 * JavaScript that gets turbo-charged with Valtio-powered reactivity. The
 * factory function must return an object literal.
 *
 * Special functions exist for declaring managed side effects, like event
 * listeners or even Valtio-powered reactions that rerun when a value changes.
 * Here's a list of the special functions: `on`, `onMount`, `subscribe`,
 * `subscribeKey`, and `watch`.
 */
export function createClass<TFactory extends InstanceFactory>(
  factory: TFactory,
  name = factory.name
): ReactiveClass<TFactory> {
  let { [name]: newClass } = {
    [name]: class extends ReactiveInstance<TFactory> {
      constructor(...args: Parameters<TFactory>) {
        super()

        let self: typeof this
        const scope = EffectScope.run(() => {
          self = unnest(copyDescriptors(this, factory.apply(this, args)))
        })
        Object.defineProperty(this, EffectScope.symbol, {
          value: scope,
        })
        scope.autoSetup()
        return self!
      }
    },
  }

  // HACK: During development, use a “double class” approach to ensure the
  // desired class name is visible to devtools without nesting the constructor
  // code inside the `new Function` call.
  if (process.env.NODE_ENV === 'development' && name !== '') {
    newClass = new Function('Super', `return class ${name} extends Super {}`)(
      newClass
    )
  }

  for (const applyExtension of classExtensions) {
    applyExtension(newClass)
  }

  return newClass as any
}

function copyDescriptors<T extends object>(
  target: T,
  source: object | (() => object)
): T {
  if (isFunction(source)) {
    source = source()
  }
  return Object.defineProperties(
    target,
    Object.getOwnPropertyDescriptors(source)
  )
}

/**
 * A class for creating reactive instances with a specific factory.
 */
export interface ReactiveClass<TFactory extends InstanceFactory> {
  new (...args: Parameters<TFactory>): ReactiveProxy<TFactory>
}

export declare namespace ReactiveClass {
  export type Extension = (constructor: ReactiveClass<InstanceFactory>) => void
}

export function addClassExtension(extension: ReactiveClass.Extension) {
  classExtensions.push(extension)
}
