import {
  parse,
  AST_NODE_TYPES as T,
} from '@typescript-eslint/typescript-estree'
import MagicString from 'magic-string'
import { dedent } from 'radashi'
import { traverse } from './utils/traverse'

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

  const proxyFunction = ast.body.find(
    node =>
      node.type === T.FunctionDeclaration &&
      node.id?.type === T.Identifier &&
      node.id.name === 'proxy'
  )

  if (!proxyFunction) {
    console.warn('[valtio-kit] Could not find `proxy` function')
    return null
  }

  let notifyUpdateFound = false
  let proxyHandlerFound = false

  traverse(proxyFunction, {
    visitors: {
      VariableDeclarator(node) {
        if (node.id.type !== T.Identifier) {
          return
        }

        // Inject the `globalThis.valtioHook` call into the `notifyUpdate`
        // function.
        if (
          node.id.name === 'notifyUpdate' &&
          node.init?.type === T.ArrowFunctionExpression
        ) {
          const functionBody = node.init.body
          if (functionBody.type === T.BlockStatement) {
            result.prependLeft(
              functionBody.range[0] + 1,
              `globalThis.valtioHook?.('update', baseObject, op, listeners);`
            )
            notifyUpdateFound = true
          }
          return
        }

        // Wrap the proxy handler with a `trackMethodCalls` call.
        if (node.id.name === 'handler' && node.init) {
          const initializer = node.init
          result.prependLeft(initializer.range[0], 'trackMethodCalls(')
          result.appendRight(initializer.range[1], ', baseObject)')
          proxyHandlerFound = true
        }
      },
    },
  })

  if (!notifyUpdateFound) {
    console.warn('[valtio-kit] Could not find `notifyUpdate` function')
    return null
  }

  if (!proxyHandlerFound) {
    console.warn('[valtio-kit] Could not find `handler` variable')
    return null
  }

  // By tracking method calls, we can coalesce set/delete operations.
  result.append(dedent/* js */ `
    function trackMethodCalls(handler, baseObject) {
      if (!globalThis.valtioHook) {
        return handler
      }
      handler.get = function(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (typeof prop === 'symbol') {
          return value
        }
        if (
          typeof value === 'function' &&
          (prop[0] < 'A' || prop[0] > 'Z') &&
          prop !== 'constructor'
        ) {
          return function(...args) {
            globalThis.valtioHook('call', value, baseObject, args)
            try {
              return value.apply(this, args)
            } finally {
              globalThis.valtioHook('return', value, baseObject, args)
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
