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
          hasCalleeNamed(node, 'createState') &&
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

        const proxyVars = new Set<string>()
        const proxyObjects = new Set<string>()
        const referencedParams = new Set<string>()
        const destructuredParams = new Set<string>()
        const watchCallbacks = new Set<TSESTree.Node>()
        const nestedNodes = new WeakSet<TSESTree.Node>()

        const isBeingWatched = (
          node: TSESTree.Identifier,
          root?: TSESTree.Node
        ) => {
          const watchCallback = findParentNode(
            node,
            parent => watchCallbacks.has(parent),
            root
          )
          return Boolean(watchCallback && !isBeingAssigned(node, watchCallback))
        }

        const enter = (
          node: TSESTree.Node,
          parent: TSESTree.Node | undefined
        ) => {
          if (!parent) return
          if (nestedNodes.has(parent)) {
            nestedNodes.add(node)
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
                // Allow $var objects to be returned, where createState can
                // subscribe to them.
                return
              }
            }

            if (parent.type === T.Property && node === parent.key) {
              if (node !== parent.value) {
                // Ignore property names.
                return
              }

              // Handle shorthand property definitions.
              let name = renamedParams.get(node.name)
              if (name) {
                if (isBeingWatched(node, root)) {
                  name = name.replace('$args', '$get($args)')
                }
                result.appendLeft(node.range[1], ': ' + name)
              } else if (proxyVars.has(node.name)) {
                let name = node.name
                if (isBeingWatched(node, root)) {
                  name = '$get(' + name + ')'
                }
                result.appendLeft(node.range[1], ': ' + node.name + '.value')
              }
              return
            }

            // Rewrite parameter names to the reactive array.
            let name = renamedParams.get(node.name)
            if (name) {
              if (isBeingWatched(node, root)) {
                name = name.replace('$args', '$get($args)')
              } else {
                const blockScope = findParentNode(node, isBlockScope)!
                if (blockScope === root.body) {
                  destructuredParams.add(node.name)
                  return
                }
              }
              result.overwrite(...node.range, name)
              referencedParams.add(node.name)
            }
            // Rewrite proxied variables to their value.
            else if (proxyVars.has(node.name)) {
              if (isBeingWatched(node, root)) {
                result.appendLeft(node.range[0], '$get(')
                result.appendLeft(node.range[1], ').value')
              } else {
                result.appendLeft(node.range[1], '.value')
              }
            }
          }
          // The createState callback must return an object literal.
          else if (node.type === T.ReturnStatement && !nestedNodes.has(node)) {
            if (!node.argument || node.argument.type !== T.ObjectExpression) {
              throwSyntaxError('You must return an object literal', node)
            }
          }
          // Any new Map/Set is replaced with proxyMap/proxySet respectively.
          else if (
            node.type === T.NewExpression &&
            node.callee.type === T.Identifier
          ) {
            const proxyFunc =
              node.callee.name === 'Map'
                ? '$proxyMap'
                : node.callee.name === 'Set'
                  ? '$proxySet'
                  : null

            if (proxyFunc) {
              imports.add(proxyFunc)
              // Remove the 'new' keyword.
              result.remove(node.range[0], node.callee.range[0])
              // Overwrite the callee with the proxy function.
              result.overwrite(...node.callee.range, proxyFunc)
            }
          }
          // Top-level variables are transformed into refs (usually).
          else if (
            node.type === T.VariableDeclarator &&
            !nestedNodes.has(node)
          ) {
            if (node.id.type !== T.Identifier) {
              return // Ignore destructuring.
            }

            if (!node.init) {
              proxyVars.add(node.id.name)
              result.appendLeft(node.id.range[1], ` = $var()`)
              imports.add('$var')
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

            let prefix = ''
            let suffix = ''

            if (varKind !== 'const') {
              proxyVars.add(node.id.name)
              imports.add('$var')
              prefix = '$var('
              suffix = ')'
            } else if (
              node.init.type === T.ObjectExpression ||
              node.init.type === T.ArrayExpression
            ) {
              proxyObjects.add(node.id.name)
              imports.add('$proxy')
              prefix = '$proxy('
              suffix = ')'
            }

            if (prefix) {
              result.prependLeft(node.init.range[0], prefix)
              result.appendRight(node.init.range[1], suffix)
            }
          }
          // Find any `watch()` calls.
          else if (node.type === T.CallExpression) {
            if (hasCalleeNamed(node, 'watch')) {
              const watchCallback = node.arguments[0]

              // Throw if the first argument is not a function.
              if (
                watchCallback.type !== T.ArrowFunctionExpression &&
                watchCallback.type !== T.FunctionExpression
              ) {
                throwSyntaxError('The first argument must be a function', node)
              }

              // Add a $get parameter to the function.
              const paramsRange = getParametersRange(watchCallback, code)
              result.appendLeft(paramsRange[0], '$get')

              // Track all watch callbacks.
              watchCallbacks.add(watchCallback)
            }
          }
          // Mark nested blocks to avoid transforming their variable
          // declarations.
          else if (isBlockScope(node)) {
            nestedNodes.add(node)
          }
        }

        simpleTraverse(root.body, { enter }, true)

        const paramsRange = getParametersRange(root, code)

        // Wrap default argument expressions in an effect.
        if (computedParams.size > 0) {
          const offset = root.body.range[0] + 1

          result.prependLeft(offset, `\n  $effect(() => {\n`)
          for (const [name, expr] of computedParams) {
            result.appendRight(
              expr.range[0],
              `    if (${name} === undefined) ${name} = `
            )
            result.prependLeft(expr.range[1], ';\n')
            result.move(...expr.range, offset)
            result.remove(paramsRange[0], expr.range[0])
            paramsRange[0] = expr.range[1]
          }
          result.appendRight(offset, `  });`)

          imports.add('$effect')
        }

        // Rewrite arguments to a single, reactive array parameter.
        if (root.params.length > 0) {
          result.remove(...paramsRange)
          result.prependRight(paramsRange[1], '$args')

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
  filter: (node: TSESTree.Node) => boolean,
  stopNode?: TSESTree.Node
): TSESTree.Node | undefined {
  let parent = node.parent
  while (parent) {
    if (parent === stopNode) {
      return undefined
    }
    if (filter(parent)) {
      return parent
    }
    parent = parent.parent
  }
}

function hasCalleeNamed(node: TSESTree.CallExpression, name: string) {
  return node.callee.type === T.Identifier && node.callee.name === name
}

function getParametersRange(
  node: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  code: string
): TSESTree.Range {
  const start =
    node.params.length > 0
      ? node.params[0].range[0]
      : code.indexOf('(', node.typeParameters?.range[1] ?? node.range[0]) + 1

  const end =
    node.params.length > 0
      ? node.params[node.params.length - 1].range[1]
      : code.lastIndexOf(')', node.returnType?.range[0] ?? node.body.range[0])

  return [start, end]
}

function isBeingAssigned(node: TSESTree.Identifier, root?: TSESTree.Node) {
  const assignment = findParentNode(
    node,
    parent =>
      parent.type === T.AssignmentExpression ||
      parent.type === T.UpdateExpression,
    root
  ) as TSESTree.AssignmentExpression | TSESTree.UpdateExpression | undefined

  return Boolean(
    assignment &&
      ((assignment.type === T.AssignmentExpression &&
        node === assignment.left) ||
        (assignment.type === T.UpdateExpression &&
          node === assignment.argument))
  )
}
