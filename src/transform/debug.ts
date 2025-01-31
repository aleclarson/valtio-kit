import {
  parse,
  simpleTraverse,
  AST_NODE_TYPES as T,
} from '@typescript-eslint/typescript-estree'
import MagicString from 'magic-string'
import { dedent } from 'radashi'

/**
 * Modify Valtio at compile-time to inject debug hooks.
 */
export function applyDebugTransform(code: string) {
  const ast = parse(code, {
    sourceType: 'module',
    loc: true,
    range: true,
  })

  const result = new MagicString(code)

  simpleTraverse(ast, {
    enter(node) {
      if (
        node.type === T.FunctionDeclaration &&
        node.id?.type === T.Identifier &&
        node.id.name === 'proxy'
      ) {
        simpleTraverse(node, {
          enter(node) {
            // Inject the `globalThis.valtioHook` call into the `notifyUpdate`
            // function.
            if (
              node.type === T.VariableDeclarator &&
              node.id.type === T.Identifier &&
              node.id.name === 'notifyUpdate' &&
              node.init?.type === T.ArrowFunctionExpression
            ) {
              const functionBody = node.init.body
              if (functionBody.type === T.BlockStatement) {
                result.prependLeft(
                  functionBody.range[0] + 1,
                  `globalThis.valtioHook?.("notifyUpdate", baseObject, op, listeners);`
                )
              }
            }

            // Wrap the proxy handler with a `trackMethodCalls` call.
            if (
              node.type === T.VariableDeclarator &&
              node.id.type === T.Identifier &&
              node.id.name === 'handler' &&
              node.init
            ) {
              const initializer = node.init
              result.prependLeft(initializer.range[0], 'trackMethodCalls(')
              result.appendRight(initializer.range[1], ', baseObject)')
            }
          },
        })
      }
    },
  })

  // By tracking method calls, we can coalesce set/delete operations.
  result.append(dedent/* js */ `
    function trackMethodCalls(handler, baseObject) {
      if (!globalThis.valtioHook) {
        return handler
      }
      handler.get = function(target, prop, receiver) {
        if (typeof prop === 'symbol' || Object.prototype.hasOwnProperty.call(target, prop)) {
          return Reflect.get(target, prop, receiver);
        }
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === 'function' && prop !== 'constructor') {
          return function(...args) {
            globalThis.valtioHook("call", value, baseObject, args)
            try {
              return value.apply(this, args)
            } finally {
              globalThis.valtioHook("return", value, baseObject, args)
            }
          }
        }
        return value
      }
      return handler
    }
  `)

  return {
    code: result.toString(),
    map: result.generateMap({ hires: 'boundary' }),
  }
}
