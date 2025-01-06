import {
  parse,
  simpleTraverse,
  AST_NODE_TYPES as T,
  TSESTree,
} from '@typescript-eslint/typescript-estree'
import { isNodeOfTypes } from '@typescript-eslint/utils/ast-utils'
import MagicString from 'magic-string'
import path from 'path'
import { Plugin } from 'vite'

const isBlockScope = isNodeOfTypes([
  T.ForInStatement,
  T.ForOfStatement,
  T.WhileStatement,
  T.DoWhileStatement,
  T.ArrowFunctionExpression,
  T.FunctionDeclaration,
  T.FunctionExpression,
  T.BlockStatement,
])

const collectionTypes = new Set(['Map', 'Set', 'WeakMap', 'WeakSet'])
const vueReactivityFuncs = new Set([
  'reactive',
  'shallowReactive',
  'ref',
  'shallowRef',
  'readonly',
  'shallowReadonly',
  'computed',
  'effect',
  'effectScope',
  'customRef',
  'markRaw',
])

export default function viteReactState(): Plugin {
  const filter = /\.state\.[jt]s$/

  return {
    name: 'vite-react-state',
    async transform(code, id) {
      if (!filter.test(id)) return

      const ast = parse(code, {
        sourceType: 'module',
        loc: true,
        range: true,
      })

      const constructors: TSESTree.ArrowFunctionExpression[] = []
      const skipped = new WeakSet<TSESTree.Node>()

      const enter = (
        node: TSESTree.Node,
        parent: TSESTree.Node | undefined
      ) => {
        if (parent && skipped.has(parent)) {
          skipped.add(node)
          return
        }
        if (skipped.has(node)) {
          return
        }

        if (
          node.type === T.CallExpression &&
          node.callee.type === T.Identifier &&
          node.callee.name === 'createState' &&
          node.arguments[0].type === T.ArrowFunctionExpression
        ) {
          constructors.push(node.arguments[0])
          skipped.add(node)
        }
      }

      simpleTraverse(ast, { enter }, true)

      const result = new MagicString(code)
      const imports = new Set<string>()

      for (const root of constructors) {
        const paramsStart =
          root.params.length > 0
            ? root.params[0].range[0]
            : code.indexOf('(', root.range[0]) + 1

        const paramsEnd =
          root.params.length > 0
            ? root.params[root.params.length - 1].range[1]
            : code.indexOf(')', paramsStart)

        const renamedParams = new Map<string, string>()
        const computedParams = new Map<string, TSESTree.Expression>()

        root.params.forEach((param, index) => {
          if (param.type === T.Identifier) {
            renamedParams.set(param.name, '$args[' + index + ']')
          } else if (param.type === T.AssignmentPattern) {
            if (param.left.type === T.Identifier) {
              renamedParams.set(param.left.name, '$args[' + index + ']')
            } else {
              unsupportedArgument(param.left, id)
            }
          } else if (param.type === T.ObjectPattern) {
            param.properties.forEach(property => {
              if (
                property.type === T.Property &&
                property.key.type === T.Identifier
              ) {
                const rename = '$args[' + index + '].' + property.key.name

                let name: string
                if (property.value.type === T.Identifier) {
                  name = property.value.name
                } else if (property.value.type === T.AssignmentPattern) {
                  if (property.value.left.type === T.Identifier) {
                    name = property.value.left.name
                  } else {
                    unsupportedArgument(property.value.left, id)
                  }
                  computedParams.set(rename, property.value.right)
                } else {
                  unsupportedArgument(property.value, id)
                }
                renamedParams.set(name, rename)
              } else {
                unsupportedArgument(param, id)
              }
            })
          } else {
            unsupportedArgument(param, id)
          }
        })

        // Wrap default argument expressions in an effect.
        if (computedParams.size > 0) {
          const offset = root.body.range[0] + 1

          result.prependLeft(offset, ` $effect(() => {`)
          for (const [name, expr] of computedParams) {
            result.appendLeft(offset, `; if (${name} === undefined) ${name} = `)
            result.move(...expr.range, offset)
          }
          result.appendRight(offset, `})`)

          imports.add('$effect')
        }

        // Rewrite arguments to a single, reactive array parameter.
        result.overwrite(paramsStart, paramsEnd, '$args')

        const skipped = new WeakSet<TSESTree.Node>()
        const reactiveVars = new Set<string>()

        const enter = (
          node: TSESTree.Node,
          parent: TSESTree.Node | undefined
        ) => {
          if (!parent) return
          if (skipped.has(node)) return
          if (skipped.has(parent)) {
            skipped.add(node)
            return
          }
          if (node.type === T.ReturnStatement) {
            // The createState callback must return an object literal.
            if (!node.argument || node.argument.type !== T.ObjectExpression) {
              unsupportedReturn(node, id)
            }
          } else if (node.type === T.Identifier) {
            if (
              parent.type === T.MemberExpression &&
              node === parent.property
            ) {
              // Ignore property access.
              return
            }

            if (parent.type === T.VariableDeclarator && node === parent.id) {
              // Ignore variable declarations.
              return
            }

            if (parent.type === T.Property) {
              const objectParent = parent.parent.parent
              if (
                objectParent.type === T.ReturnStatement &&
                objectParent.parent === root.body
              ) {
                // Allow reactive variables to be returned.
                return
              }
            }

            const rename = renamedParams.get(node.name)

            if (parent.type === T.Property && node === parent.key) {
              if (
                node === parent.value &&
                (rename || reactiveVars.has(node.name))
              ) {
                result.appendLeft(
                  node.range[1],
                  ': ' + (rename ?? node.name + '.value')
                )
              }
              // Ignore property names.
              return
            }

            // Rewrite parameter names to the reactive array.
            if (rename) {
              result.overwrite(...node.range, rename)
            }
            // Rewrite reactive variables to their value.
            else if (reactiveVars.has(node.name)) {
              result.appendLeft(node.range[1], '.value')
            }
          }
          // Look for variable declarations.
          else if (node.type === T.VariableDeclarator) {
            if (node.id.type !== T.Identifier) {
              return // Ignore destructuring.
            }

            if (!node.init) {
              reactiveVars.add(node.id.name)
              result.appendLeft(node.id.range[1], ` = $shallowRef()`)
              imports.add('$shallowRef')
              return
            }

            if (
              node.init.type === T.CallExpression &&
              node.init.callee.type === T.Identifier &&
              vueReactivityFuncs.has(node.init.callee.name)
            ) {
              // Ignore variables using a @vue/reactivity function.
              return
            }

            const varKind = (parent as TSESTree.VariableDeclaration).kind

            if (
              varKind === 'const' &&
              (node.init.type === T.ArrowFunctionExpression ||
                node.init.type === T.FunctionExpression)
            ) {
              // Ignore function variables (if constant).
              return
            }

            let deepReactive = false
            let computed = false

            if (
              node.init.type === T.ObjectExpression ||
              node.init.type === T.ArrayExpression ||
              node.init.type === T.NewExpression
            ) {
              // Object literals, array literals, and collections (e.g. Map,
              // Set, WeakMap, WeakSet) are all deeply reactive.
              deepReactive =
                node.init.type !== T.NewExpression ||
                (node.init.callee.type === T.Identifier &&
                  collectionTypes.has(node.init.callee.name))
            }
            // All other variables are either computed or shallow refs.
            else if (varKind === 'const') {
              computed = true
            }

            if (computed || varKind !== 'const') {
              reactiveVars.add(node.id.name)
            }

            let prefix = ''
            let suffix = ''

            if (computed) {
              imports.add('$computed')
              prefix = '$computed(() => '
              suffix = ')'
            } else if (varKind === 'let') {
              imports.add('$shallowRef')
              prefix = '$shallowRef('
              suffix = ')'
            }
            if (deepReactive) {
              imports.add('$reactive')
              prefix += '$reactive('
              suffix += ')'
            }

            result.prependRight(node.init.range[0], prefix)
            result.appendLeft(node.init.range[1], suffix)
          }
          // Do not transform anything in a block scope.
          else if (isBlockScope(node)) {
            skipped.add(node)
          }
        }

        simpleTraverse(root.body, { enter }, true)
      }

      if (!result.hasChanged()) {
        return
      }

      imports.add('createState')

      if (imports.size > 0) {
        const rootDir =
          process.env.TEST === 'vite-react-state'
            ? '/path/to/vite-react-state'
            : new URL('.', import.meta.url).pathname

        const runtimePath = path.resolve(rootDir, 'runtime.js')
        result.prepend(
          `import { ${Array.from(imports).join(', ')} } from '/@fs/${runtimePath}'\n`
        )
      }

      return {
        code: result.toString(),
        map: result.generateMap({ hires: 'boundary' }),
      }
    },
  }
}

function unsupportedArgument(node: TSESTree.Node, filename: string): never {
  throw new Error(
    `[vite-react-state] Unsupported argument type: ${node.type} (at ${nodeLocation(node, filename)})`
  )
}

function unsupportedReturn(node: TSESTree.Node, filename: string): never {
  throw new Error(
    `[vite-react-state] Unsupported return type: ${node.type} (at ${nodeLocation(node, filename)})`
  )
}

function nodeLocation(node: TSESTree.Node, filename: string) {
  const { line, column } = node.loc.start
  return `${filename}:${line}:${column}`
}

function findParentNode(
  node: TSESTree.Node,
  test: (node: TSESTree.Node) => boolean
): TSESTree.Node | undefined {
  let parent = node.parent
  while (parent) {
    if (test(parent)) {
      return parent
    }
    parent = parent.parent
  }
}
