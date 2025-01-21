import { createFilter, FilterPattern, Plugin } from 'vite'
import { transform } from '../transform'

export type Options = {
  /**
   * @default /\.state\.[jt]s$/
   */
  include?: FilterPattern
  /**
   * @default /\/node_modules\//
   */
  exclude?: FilterPattern
  /**
   * Automatically import any functions provided by the
   * `valtio-kit/runtime` package, instead of having to import them
   * manually.
   *
   * If you enable this, you should also include the `valtio-kit/globals`
   * type declaration in your `tsconfig.json` file or with a triple-slash
   * directive.
   *
   * @default false
   */
  globals?: boolean
  /** @internal */
  onTransform?: (code: string, id: string) => void
  /** @internal */
  runtimePath?: string
}

export function valtioKit(options: Options = {}): Plugin {
  const filter = createFilter(
    options.include ?? /\.state\.[jt]s$/,
    options.exclude ?? /\/node_modules\//
  )

  const runtimePath = options.runtimePath ?? 'valtio-kit/runtime'

  return {
    name: 'valtio-kit/transform',
    config: () => ({
      resolve: {
        dedupe: ['valtio', 'valtio-kit'],
      },
      optimizeDeps: {
        exclude: ['valtio', 'valtio-kit', runtimePath],
      },
    }),
    async transform(code, id) {
      if (!filter(id)) {
        return null
      }
      const result = transform(code, id, runtimePath, options)
      if (result && options.onTransform) {
        options.onTransform(result.code, id)
      }
      return result
    },
  }
}
