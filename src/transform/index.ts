import {
  parse,
  simpleTraverse,
  AST_NODE_TYPES as T,
  TSESTree,
} from '@typescript-eslint/typescript-estree'
import { isNodeOfTypes } from '@typescript-eslint/utils/ast-utils'
import MagicString from 'magic-string'
import { isAbsolute } from 'path'
import { castArray } from 'radashi'

const isBlockScope = isNodeOfTypes([
  T.ForStatement,
  T.ForInStatement,
  T.ForOfStatement,
  T.WhileStatement,
  T.DoWhileStatement,
  T.ArrowFunctionExpression,
  T.FunctionDeclaration,
  T.FunctionExpression,
  T.BlockStatement,
])

const globalFunctions = [
  'computed',
  'getVersion',
  'on',
  'onMount',
  'ref',
  'snapshot',
  'subscribe',
  'subscribeKey',
  'watch',
]

export function transform(
  code: string,
  filePath: string,
  options: { runtimePath?: string; globals?: boolean } = {}
) {
  const ast = parse(code, {
    filePath,
    sourceType: 'module',
    loc: true,
    range: true,
  })

  const constructors: TSESTree.ArrowFunctionExpression[] = []
  const skipped = new WeakSet<TSESTree.Node>()

  const enter = (node: TSESTree.Node, parent: TSESTree.Node | undefined) => {
    if (parent && skipped.has(parent)) {
      skipped.add(node)
      return
    }
    if (skipped.has(node)) {
      return
    }

    if (
      node.type === T.CallExpression &&
      hasCalleeNamed(node, 'createClass') &&
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
    const atoms = new Set<string>()
    const proxies = new Set<string>()
    const objectsContainingAtoms = new Set<TSESTree.Node>()
    const watchCallbacks = new Set<TSESTree.Node>()
    const nestedNodes = new WeakSet<TSESTree.Node>()
    const scopes = new Map<TSESTree.Node, BlockScope>()

    const closestScope = (node: TSESTree.Node) => {
      const scope = findParentNode(node, isBlockScope)
      return scope ? scopes.get(scope) : undefined
    }

    const isGlobalCallTo = (node: TSESTree.CallExpression, name: string) => {
      if (!hasCalleeNamed(node, name)) {
        return false
      }
      const scope = closestScope(node)
      return !!scope && !findBindingFromScope(name, scope)
    }

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

    const enter = (node: TSESTree.Node, parent: TSESTree.Node | undefined) => {
      if (parent && nestedNodes.has(parent)) {
        nestedNodes.add(node)
      }
      if (node.type === T.Identifier) {
        if (!parent) return

        if (parent.type === T.MemberExpression && node === parent.property) {
          // Ignore property access.
          return
        }

        if (parent.type === T.NewExpression && node === parent.callee) {
          // Ignore new expressions.
          return
        }

        if (parent.type === T.VariableDeclarator && node === parent.id) {
          // Ignore variable declarations.
          return
        }

        if (parent.type === T.Property) {
          if (node === parent.key) {
            // Ignore property names.
            return
          }

          const objectLiteral = parent.parent
          const scope = closestScope(objectLiteral)!
          const returnStmt = findParentNode(
            objectLiteral,
            parent => parent.type === T.ReturnStatement,
            scope.node
          )

          if (returnStmt && returnStmt.parent === root.body) {
            // Allow $atom objects to be returned, where createClass can
            // subscribe to them.
            if (atoms.has(node.name)) {
              objectsContainingAtoms.add(objectLiteral)
            }
            return
          }

          // Handle shorthand property definitions.
          if (node === parent.value && node.range[0] === parent.key.range[0]) {
            if (atoms.has(node.name)) {
              let name = node.name
              if (isBeingWatched(node, root)) {
                name = '$get(' + name + ')'
              }
              result.appendLeft(node.range[1], ': ' + node.name + '.value')
            }
            return
          }
        }

        if (
          (atoms.has(node.name) || proxies.has(node.name)) &&
          isBeingWatched(node, root)
        ) {
          result.appendLeft(node.range[0], '$get(')
          result.appendLeft(node.range[1], ')')
        }

        // Rewrite atoms to their value.
        if (atoms.has(node.name)) {
          if (
            node.parent.type === T.CallExpression &&
            node === node.parent.arguments[0] &&
            isGlobalCallTo(node.parent, 'subscribe')
          ) {
            // Avoid unboxing an atom passed as the first argument of a
            // `subscribe` call.
            return
          }
          result.appendLeft(node.range[1], '.value')
        }
      }
      // The createClass callback must return an object literal.
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

          const variableDeclarator = findParentNode(
            node,
            parent => parent.type === T.VariableDeclarator,
            root
          ) as TSESTree.VariableDeclarator | undefined

          if (
            variableDeclarator &&
            variableDeclarator.id.type === T.Identifier &&
            variableDeclarator.init === node
          ) {
            proxies.add(variableDeclarator.id.name)
          }
        }
      }
      // Top-level variables are transformed into refs (usually).
      else if (node.type === T.VariableDeclarator && !nestedNodes.has(node)) {
        if (node.id.type !== T.Identifier) {
          return // Ignore destructuring.
        }

        if (!node.init) {
          atoms.add(node.id.name)
          result.appendLeft(node.id.range[1], ` = $atom()`)
          imports.add('$atom')
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

        let computedProperty: TSESTree.Property | undefined
        if (node.init.type === T.ObjectExpression) {
          computedProperty = node.init.properties.find(
            property =>
              property.type === T.Property &&
              property.value.type === T.CallExpression &&
              hasCalleeNamed(property.value, 'computed')
          ) as TSESTree.Property | undefined

          if (computedProperty) {
            imports.add('$unnest')
            prefix = '$unnest('
            suffix = ')'
          }
        }

        if (varKind !== 'const') {
          atoms.add(node.id.name)
          imports.add('$atom')
          prefix = '$atom(' + prefix
          suffix = suffix + ')'
        } else if (
          node.init.type === T.ArrayExpression ||
          (node.init.type === T.ObjectExpression && !computedProperty)
        ) {
          proxies.add(node.id.name)
          imports.add('$proxy')
          prefix = '$proxy(' + prefix
          suffix = suffix + ')'
        }

        if (prefix) {
          result.prependLeft(node.init.range[0], prefix)
          result.appendRight(node.init.range[1], suffix)
        }
      }
      // Add imports for global functions being used.
      else if (node.type === T.CallExpression) {
        const globalFunction = globalFunctions.find(name =>
          isGlobalCallTo(node, name)
        )
        if (globalFunction && options.globals) {
          imports.add(globalFunction)
        }
        if (globalFunction === 'watch' || globalFunction === 'computed') {
          // Throw if the first argument is not a function.
          const watchCallback = node.arguments[0]
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

          // Treat computed variables as atoms.
          if (globalFunction === 'computed') {
            if (node.parent.type === T.Property && node === node.parent.value) {
              // Allow computed(…) to declare a computed property.
              return
            }

            const variableDeclarator =
              node.parent.type === T.VariableDeclarator
                ? node.parent
                : undefined

            if (!variableDeclarator) {
              throwSyntaxError(
                "Cannot use computed(…) outside of a const variable's initializer",
                node
              )
            }
            if (variableDeclarator.parent.kind !== 'const') {
              throwSyntaxError(
                `Expected 'const' keyword in computed variable declaration`,
                variableDeclarator.parent
              )
            }
            if (variableDeclarator.id.type === T.Identifier) {
              atoms.add(variableDeclarator.id.name)
            }
          }
        }
      }
      // Scope tracking
      else if (isBlockScope(node)) {
        // Prevent variables in nested blocks from being transformed.
        if (parent) {
          nestedNodes.add(node)
        }

        // Find parent scope.
        const parentBlock = findParentNode(node, isBlockScope)

        // Collect all variables/parameters in the block.
        const scope: BlockScope = {
          node,
          names: [],
          parent: parentBlock ? scopes.get(parentBlock) : undefined,
        }
        scopes.set(node, scope)

        const block = node
        switch (block.type) {
          case T.ArrowFunctionExpression:
          case T.FunctionExpression:
          case T.FunctionDeclaration:
            for (const param of block.params) {
              trackBindingPattern(param, scope)
            }
          /* fallthrough */
          case T.WhileStatement:
          case T.DoWhileStatement:
            trackImmediateBindings(
              block.body.type === T.BlockStatement
                ? block.body.body
                : castArray(block.body),
              scope
            )
            break
          case T.ForStatement:
            // Track loop variable
            if (block.init?.type === T.VariableDeclaration) {
              for (const decl of block.init.declarations) {
                trackBindingPattern(decl.id, scope)
              }
            }
            if (block.body.type === T.BlockStatement) {
              trackImmediateBindings(block.body.body, scope)
            }
            break
          case T.ForInStatement:
          case T.ForOfStatement:
            // Track loop variable
            if (block.left.type === T.VariableDeclaration) {
              for (const decl of block.left.declarations) {
                trackBindingPattern(decl.id, scope)
              }
            }
            if (block.body.type === T.BlockStatement) {
              trackImmediateBindings(block.body.body, scope)
            }
            break
          case T.BlockStatement:
            trackImmediateBindings(block.body, scope)
            break
        }
      }
    }

    simpleTraverse(root.body, { enter }, true)

    // Object literals are wrapped with `unnest(…)` except for the topmost
    // object literal, which is handled by createClass.
    for (const objectLiteral of objectsContainingAtoms) {
      const container = findParentNode(
        objectLiteral,
        parent =>
          parent.type === T.Property ||
          parent.type === T.ReturnStatement ||
          parent.type === T.VariableDeclarator
      )
      if (container && container.type !== T.ReturnStatement) {
        imports.add('$unnest')
        result.appendLeft(objectLiteral.range[0], '$unnest(')
        result.appendLeft(objectLiteral.range[1], ')')
      }
    }
  }

  if (!result.hasChanged()) {
    return
  }

  if (options.globals) {
    imports.add('createClass')
  }

  if (imports.size > 0) {
    let runtimePath =
      options.runtimePath ?? new URL('./runtime.js', import.meta.url).pathname

    if (isAbsolute(runtimePath)) {
      runtimePath = `/@fs/${runtimePath}`
    }

    result.prepend(
      `import { ${Array.from(imports).join(', ')} } from '${runtimePath}'\n`
    )
  }

  return {
    code: result.toString(),
    map: result.generateMap({ hires: 'boundary' }),
  }
}

function throwSyntaxError(message: string, node: TSESTree.Node): never {
  const error: any = new SyntaxError(message)
  error.loc = node.loc.start
  throw error
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

  let ident: TSESTree.Node = node
  while (ident.parent.type === T.MemberExpression) {
    ident = ident.parent
  }

  return Boolean(
    assignment &&
      ((assignment.type === T.AssignmentExpression &&
        ident === assignment.left) ||
        (assignment.type === T.UpdateExpression &&
          ident === assignment.argument))
  )
}

type BlockScope = {
  node: TSESTree.Node
  names: string[]
  parent: BlockScope | undefined
}

function trackBindingPattern(
  node: TSESTree.Parameter | TSESTree.DestructuringPattern,
  scope: BlockScope
) {
  if (node.type === T.Identifier) {
    scope.names.push(node.name)
  } else if (node.type === T.RestElement) {
    trackBindingPattern(node.argument, scope)
  } else if (node.type === T.ArrayPattern) {
    for (const element of node.elements) {
      element && trackBindingPattern(element, scope)
    }
  } else if (node.type === T.ObjectPattern) {
    for (const property of node.properties) {
      if (property.type === T.RestElement) {
        trackBindingPattern(property.argument, scope)
      } else if (property.key.type === T.Identifier) {
        trackBindingPattern(property.key, scope)
      }
    }
  } else if (node.type === T.AssignmentPattern) {
    trackBindingPattern(node.left, scope)
  }
}

function trackImmediateBindings(body: TSESTree.Node[], scope: BlockScope) {
  for (const node of body) {
    if (node.type === T.VariableDeclaration) {
      for (const decl of node.declarations) {
        trackBindingPattern(decl.id, scope)
      }
    }
  }
}

function findBindingFromScope(name: string, scope: BlockScope | undefined) {
  while (scope) {
    if (scope.names.includes(name)) {
      return true
    }
    scope = scope.parent
  }
  return false
}
