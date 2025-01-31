import {
  parse,
  simpleTraverse,
  AST_NODE_TYPES as T,
} from '@typescript-eslint/typescript-estree'
import MagicString from 'magic-string'

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
          },
        })
      }
    },
  })

  return {
    code: result.toString(),
    map: result.generateMap({ hires: 'boundary' }),
  }
}
