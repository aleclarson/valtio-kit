import type { TestRunnerPlugin } from '@web/test-runner'
import { transform } from '../transform'

export type Options = {
  /**
   * @default /\.state\.[jt]s$/
   */
  include?: RegExp
  /**
   * @default /\/node_modules\//
   */
  exclude?: RegExp
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
}

export function valtioKit(options: Options = {}): TestRunnerPlugin {
  const include = options.include ?? /\.state\.[jt]s$/
  const exclude = options.exclude ?? /\/node_modules\//

  const runtimePath = 'valtio-kit/runtime'

  return {
    name: 'valtio-kit',
    async transform(context) {
      if (!context.response.is('js')) {
        return
      }
      if (!include.test(context.path)) {
        return
      }
      if (exclude.test(context.path)) {
        return
      }
      if (typeof context.body !== 'string') {
        return
      }

      const result = transform(context.body, context.path, runtimePath, {
        globals: options.globals,
        debug: true,
      })

      if (!result) {
        return
      }

      return `${result.code}\n//# sourceMappingURL=${result.map.toUrl()}`
    },
  }
}
