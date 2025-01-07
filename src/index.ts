import {
  parse,
  simpleTraverse,
  AST_NODE_TYPES as T,
  TSESTree,
} from '@typescript-eslint/typescript-estree'
import { isNodeOfTypes } from '@typescript-eslint/utils/ast-utils'
import MagicString from 'magic-string'
import path from 'path'
import { createFilter, FilterPattern, Plugin } from 'vite'

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

export type Options = {
  /**
   * @default /\.state\.[jt]s$/
   */
  include?: FilterPattern
  exclude?: FilterPattern
  onTransform?: (code: string, id: string) => void
}

export default function reactStatePlugin(options: Options = {}): Plugin {
  const filter = createFilter(
    options.include ?? /\.state\.[jt]s$/,
    options.exclude
  )

  return {
    name: 'vite-react-state',
    async transform(code, id) {
      if (!filter(id)) return

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
        const renamedParams = new Map<string, string>()
        const computedParams = new Map<string, TSESTree.Expression>()

        root.params.forEach((param, index) => {
          const rename = '$args[' + index + ']'

          if (param.type === T.Identifier) {
            renamedParams.set(param.name, rename)
          } else if (param.type === T.AssignmentPattern) {
            if (index === 0) {
              throwSyntaxError('The first parameter cannot be optional', param)
            }
            if (param.left.type === T.Identifier) {
              renamedParams.set(param.left.name, rename)
            } else {
              throwUnsupportedArgument(param.left)
            }
            computedParams.set(rename, param.right)
          } else if (param.type === T.ObjectPattern) {
            param.properties.forEach(property => {
              if (
                property.type === T.Property &&
                property.key.type === T.Identifier
              ) {
                let name: string
                if (property.value.type === T.Identifier) {
                  name = property.value.name
                } else if (property.value.type === T.AssignmentPattern) {
                  if (property.value.left.type === T.Identifier) {
                    name = property.value.left.name
                  } else {
                    throwUnsupportedArgument(property.value.left)
                  }
                  computedParams.set(
                    rename + '.' + property.key.name,
                    property.value.right
                  )
                } else {
                  throwUnsupportedArgument(property.value)
                }
                renamedParams.set(name, rename + '.' + property.key.name)
              } else {
                throwUnsupportedArgument(param)
              }
            })
          } else {
            throwUnsupportedArgument(param)
          }
        })

        const nested = new WeakSet<TSESTree.Node>()
        const reactiveVars = new Set<string>()
        const referencedParams = new Set<string>()
        const destructuredParams = new Set<string>()

        const enter = (
          node: TSESTree.Node,
          parent: TSESTree.Node | undefined
        ) => {
          if (!parent) return
          if (nested.has(parent)) {
            nested.add(node)
          }
          if (node.type === T.Identifier) {
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
              // Check if the reference is within the initializer of a reactive
              // variable that wasn't declared with the `const` keyword. In this
              // case, we don't need to rewrite the parameter name, which would
              // only make step debugging less ergonomic.
              const variableOrBlock = findParentNode(
                node,
                p => p.type === T.VariableDeclarator || isBlockScope(p)
              )
              const isReactive =
                variableOrBlock?.type !== T.VariableDeclarator ||
                variableOrBlock.parent.kind === 'const'

              if (isReactive) {
                result.overwrite(...node.range, rename)
                referencedParams.add(node.name)
              } else {
                // Destructure the initial parameter value for a better step
                // debugging experience.
                destructuredParams.add(node.name)
              }
            }
            // Rewrite reactive variables to their value.
            else if (reactiveVars.has(node.name)) {
              result.appendLeft(node.range[1], '.value')
            }
          }
          // The createState callback must return an object literal.
          else if (node.type === T.ReturnStatement && !nested.has(node)) {
            if (!node.argument || node.argument.type !== T.ObjectExpression) {
              throwSyntaxError('You must return an object literal', node)
            }
          }
          // Top-level variables are transformed into refs (usually).
          else if (node.type === T.VariableDeclarator && !nested.has(node)) {
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

            result.prependLeft(node.init.range[0], prefix)
            result.appendRight(node.init.range[1], suffix)
          }
          // Do not transform anything in a block scope.
          else if (isBlockScope(node)) {
            nested.add(node)
          }
        }

        simpleTraverse(root.body, { enter }, true)

        let paramsStart =
          root.params.length > 0
            ? root.params[0].range[0]
            : code.indexOf('(', root.range[0]) + 1

        // Wrap default argument expressions in an effect.
        if (computedParams.size > 0) {
          const offset = root.body.range[0] + 1

          result.prependLeft(offset, `\n  $effect(() => {\n`)
          for (const [name, expr] of computedParams) {
            result.appendRight(
              expr.range[0],
              `    if (${name} === undefined) ${name} = `
            )
            result.prependLeft(expr.range[1], ';\n  ')
            result.move(...expr.range, offset)
            result.remove(paramsStart, expr.range[0])
            paramsStart = expr.range[1]
          }
          result.appendRight(offset, `});`)

          imports.add('$effect')
        }

        const paramsEnd =
          root.params.length > 0
            ? root.params[root.params.length - 1].range[1]
            : code.indexOf(')', paramsStart)

        // Rewrite arguments to a single, reactive array parameter.
        result.remove(paramsStart, paramsEnd)
        result.prependRight(paramsEnd, '$args')

        if (destructuredParams.size > 0) {
          const offset = root.body.range[0] + 1

          for (const name of destructuredParams) {
            result.appendRight(
              offset,
              `\n  const ${name} = ${renamedParams.get(name)};`
            )
          }
        }
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

      const transformedCode = result.toString()
      options.onTransform?.(transformedCode, id)

      return {
        code: transformedCode,
        map: result.generateMap({ hires: 'boundary' }),
      }
    },
  }
}

function throwSyntaxError(message: string, node: TSESTree.Node): never {
  const error: any = new SyntaxError(message)
  error.loc = node.loc.start
  throw error
}

function throwUnsupportedArgument(node: TSESTree.Node): never {
  throwSyntaxError(`Unsupported argument syntax: ${node.type}`, node)
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
