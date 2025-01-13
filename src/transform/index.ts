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
    if (root.body.type !== T.BlockStatement) {
      throwSyntaxError(
        'Every `createClass` factory function must have curly braces',
        root.body
      )
    }

    const atoms = new Set<string>()
    const proxies = new Set<string>()
    const objectsContainingAtoms = new Set<TSESTree.Node>()
    const watchCallbacks = new Set<TSESTree.Node>()
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

    const isRootScope = (scope: BlockScope) => {
      return scope.parent === undefined
    }

    const isRootReference = (node: TSESTree.Identifier) => {
      const scope = closestScope(node)!
      return findBindingFromScope(node.name, scope, isRootScope)
    }

    const isAtomReference = (node: TSESTree.Identifier) =>
      atoms.has(node.name) && isRootReference(node)

    const isAtomOrProxyReference = (node: TSESTree.Identifier) =>
      (atoms.has(node.name) || proxies.has(node.name)) && isRootReference(node)

    const isReactiveAssignment = (
      assignment: TSESTree.AssignmentExpression | TSESTree.VariableDeclarator
    ) => {
      if (assignment.type === T.VariableDeclarator) {
        return (
          assignment.id.type === T.Identifier && isRootReference(assignment.id)
        )
      }
      let id = assignment.left
      while (id.type === T.MemberExpression) {
        id = id.object
      }
      // TODO: check for ref(…) objects which disable reactivity.
      return id.type === T.Identifier && isRootReference(id)
    }

    const enter = (node: TSESTree.Node, parent: TSESTree.Node | undefined) => {
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
            if (isAtomReference(node)) {
              objectsContainingAtoms.add(objectLiteral)
            }
            return
          }

          // Handle shorthand property definitions.
          if (node === parent.value && node.range[0] === parent.key.range[0]) {
            if (isAtomReference(node)) {
              let name = node.name
              if (isBeingWatched(node, root)) {
                name = '$get(' + name + ')'
              }
              result.appendLeft(node.range[1], ': ' + node.name + '.value')
            }
            return
          }
        }

        if (isAtomOrProxyReference(node) && isBeingWatched(node, root)) {
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
      // The factory function must return an object literal.
      else if (node.type === T.ReturnStatement) {
        let scope = closestScope(node)!
        while (scope.parent) {
          if (functionScopes.includes(scope.node.type)) {
            // Ignore return statements inside function bodies.
            return
          }
          scope = scope.parent
        }
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
          const assignment = findParentNode(
            node,
            parent =>
              parent.type === T.VariableDeclarator ||
              parent.type === T.AssignmentExpression,
            root
          ) as
            | TSESTree.VariableDeclarator
            | TSESTree.AssignmentExpression
            | undefined

          // Skip the transform if not being assigned to a root-level variable.
          if (assignment && isReactiveAssignment(assignment)) {
            if (
              assignment.type === T.VariableDeclarator &&
              assignment.id.type === T.Identifier
            ) {
              proxies.add(assignment.id.name)
            }
            imports.add(proxyFunc)

            // Remove the 'new' keyword.
            result.remove(node.range[0], node.callee.range[0])

            // Overwrite the callee with the proxy function.
            result.overwrite(...node.callee.range, proxyFunc)
          }
        }
      }
      // Top-level variables are transformed into refs (usually).
      else if (node.type === T.VariableDeclarator) {
        let scope = closestScope(node)!
        while (scope.parent) {
          if (
            functionScopes.includes(scope.node.type) ||
            loopScopes.includes(scope.node.type)
          ) {
            // Ignore variable declarations inside function bodies or loops.
            return
          }
          scope = scope.parent
        }

        if (node.id.type === T.Identifier) {
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
        // Handle variables declared with destructuring.
        else if (isReassignable(node)) {
          const names: string[] = []
          findBindingsInDeclarator(node.id, id => {
            names.push(id.name)
          })
          if (names.length > 1) {
            imports.add('$atom')
            for (const name of names) {
              result.appendLeft(
                node.parent.range[1],
                ` ${name} = $atom(${name});`
              )
            }
          }
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

            // Support computed property assignments.
            if (
              node.parent.type === T.AssignmentExpression &&
              node === node.parent.right
            ) {
              if (node.parent.left.type !== T.MemberExpression) {
                throwSyntaxError(
                  'Computed assignments must be property assignments',
                  node
                )
              }
              if (node.parent.operator !== '=') {
                throwSyntaxError(
                  'Computed assignment must use "=" operator',
                  node
                )
              }

              const key = node.parent.left.property

              // Replace "." with "," because the object and property parts are
              // being split into separate arguments.
              result.overwrite(key.range[0] - 1, key.range[0], ', ')

              // Replace "=" with "," because the compute function is the third
              // argument to the $assign call.
              result.overwrite(
                key.range[1],
                code.indexOf('=', key.range[0]) + 1,
                ','
              )

              if (key.type === T.Identifier) {
                // Stringify the property name.
                result.overwrite(
                  key.range[0],
                  key.range[1],
                  JSON.stringify(key.name)
                )
              } else if (key.type === T.Literal) {
                // Remove square braces for computed property keys.
                result.remove(key.range[0] - 1, key.range[0])
              } else {
                // The property is dynamic.
                result.appendLeft(key.range[0], '() => ')
              }

              // The `computed` call is replaced with an $assign call.
              result.remove(...node.callee.range)

              let prefix = ''
              if (node.parent.left.object.type !== T.Identifier) {
                prefix = '() => '
              }

              imports.add('$assign')
              result.prependLeft(node.parent.range[0], '$assign(' + prefix)
              result.appendRight(node.parent.range[1], ')')
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
            if (isReassignable(variableDeclarator)) {
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
        // Find parent scope.
        const parentBlock = findParentNode(node, isBlockScope)

        // Collect all variables/parameters in the block.
        const scope: BlockScope = {
          node,
          names: [],
          parent: parentBlock ? scopes.get(parentBlock) : undefined,
        }
        scopes.set(node, scope)
        const onIdentifier = (node: TSESTree.Identifier) => {
          scope.names.push(node.name)
        }

        const block = node
        switch (block.type) {
          case T.ArrowFunctionExpression:
          case T.FunctionExpression:
          case T.FunctionDeclaration:
            for (const param of block.params) {
              findBindingsInDeclarator(param, onIdentifier)
            }
          /* fallthrough */
          case T.WhileStatement:
          case T.DoWhileStatement:
            findBindingsInArray(
              block.body.type === T.BlockStatement
                ? block.body.body
                : castArray(block.body),
              onIdentifier
            )
            break
          case T.ForStatement:
            // Track loop variable
            if (block.init?.type === T.VariableDeclaration) {
              for (const decl of block.init.declarations) {
                findBindingsInDeclarator(decl.id, onIdentifier)
              }
            }
            if (block.body.type === T.BlockStatement) {
              findBindingsInArray(block.body.body, onIdentifier)
            }
            break
          case T.ForInStatement:
          case T.ForOfStatement:
            // Track loop variable
            if (block.left.type === T.VariableDeclaration) {
              for (const decl of block.left.declarations) {
                findBindingsInDeclarator(decl.id, onIdentifier)
              }
            }
            if (block.body.type === T.BlockStatement) {
              findBindingsInArray(block.body.body, onIdentifier)
            }
            break
          case T.BlockStatement:
            findBindingsInArray(block.body, onIdentifier)
            break
        }
      }
    }

    prepareDynamicParams(root, result, imports, atoms)
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

    // Append variable name to createClass call arguments.
    const variableDeclarator = findParentNode(
      root,
      parent => parent.type === T.VariableDeclarator
    ) as TSESTree.VariableDeclarator | undefined

    if (variableDeclarator && variableDeclarator.id.type === T.Identifier) {
      result.appendLeft(
        root.range[1],
        `, ${JSON.stringify(variableDeclarator.id.name)}`
      )
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
      options.runtimePath ??
      new URL('./runtime/index.js', import.meta.url).pathname

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

const loopScopes = [
  T.ForStatement,
  T.ForInStatement,
  T.ForOfStatement,
  T.WhileStatement,
  T.DoWhileStatement,
]

const functionScopes = [
  T.ArrowFunctionExpression,
  T.FunctionDeclaration,
  T.FunctionExpression,
]

const isBlockScope = isNodeOfTypes([
  ...loopScopes,
  ...functionScopes,
  T.BlockStatement,
])

const isAssignmentLeft = isNodeOfTypes([
  T.ArrayPattern,
  T.ObjectPattern,
  T.Identifier,
])

const globalFunctions = [
  'computed',
  'getVersion',
  'on',
  'onMount',
  'onUpdate',
  'ref',
  'snapshot',
  'subscribe',
  'subscribeKey',
  'watch',
]

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

  if (!assignment) {
    return false
  }
  if (assignment.type === T.AssignmentExpression) {
    return (
      isAssignmentLeft(assignment.left) &&
      findBindingsInDeclarator(assignment.left, id => id === ident)
    )
  }
  if (assignment.type === T.UpdateExpression) {
    return ident === assignment.argument
  }
  return false
}

type BlockScope = {
  node: TSESTree.Node
  names: string[]
  parent: BlockScope | undefined
}

function findBindingsInDeclarator(
  node: TSESTree.Parameter | TSESTree.DestructuringPattern,
  onIdentifier: (node: TSESTree.Identifier) => boolean | void
): boolean {
  if (node.type === T.Identifier) {
    return Boolean(onIdentifier(node))
  }
  if (node.type === T.RestElement) {
    return findBindingsInDeclarator(node.argument, onIdentifier)
  }
  if (node.type === T.AssignmentPattern) {
    return findBindingsInDeclarator(node.left, onIdentifier)
  }
  if (node.type === T.ArrayPattern) {
    for (const element of node.elements) {
      if (element && findBindingsInDeclarator(element, onIdentifier)) {
        return true
      }
    }
  } else if (node.type === T.ObjectPattern) {
    for (const property of node.properties) {
      const found =
        property.type === T.RestElement
          ? findBindingsInDeclarator(property.argument, onIdentifier)
          : property.value.type === T.Identifier
            ? Boolean(onIdentifier(property.value))
            : property.value.type === T.ObjectPattern ||
                property.value.type === T.ArrayPattern ||
                property.value.type === T.AssignmentPattern
              ? findBindingsInDeclarator(property.value, onIdentifier)
              : undefined

      if (found === true) {
        return true
      }
    }
  }
  return false
}

function findBindingsInArray(
  body: TSESTree.Node[],
  onIdentifier: (node: TSESTree.Identifier) => void
) {
  for (const node of body) {
    if (node.type === T.VariableDeclaration) {
      for (const decl of node.declarations) {
        findBindingsInDeclarator(decl.id, onIdentifier)
      }
    }
  }
}

function findBindingFromScope(
  name: string,
  scope: BlockScope | undefined,
  test?: (scope: BlockScope) => boolean
) {
  while (scope) {
    if (scope.names.includes(name)) {
      return !test || test(scope)
    }
    scope = scope.parent
  }
  return false
}

function prepareDynamicParams(
  root: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  result: MagicString,
  imports: Set<string>,
  atoms: Set<string>
) {
  const params = new Set<string>()
  const dynamicParams = new Set<string>()

  for (const param of root.params) {
    findBindingsInDeclarator(param, id => {
      params.add(id.name)
    })
  }

  const enter = (node: TSESTree.Node) => {
    if (
      node.type === T.UpdateExpression &&
      node.argument.type === T.Identifier &&
      params.has(node.argument.name)
    ) {
      dynamicParams.add(node.argument.name)
    } else if (
      node.type === T.AssignmentExpression &&
      isAssignmentLeft(node.left)
    ) {
      findBindingsInDeclarator(node.left, id => {
        if (params.has(id.name)) {
          dynamicParams.add(id.name)
          return true
        }
      })
    }
  }

  for (const node of castArray(root.body)) {
    simpleTraverse(node, { enter })
  }

  // Dynamic parameters are re-assigned with `foo = $atom(foo)` at the start of
  // the factory function body.
  for (const name of dynamicParams) {
    result.appendLeft(root.body.range[0] + 1, `\n  ${name} = $atom(${name});`)
    imports.add('$atom')
    atoms.add(name)
  }
}

function isReassignable(node: TSESTree.VariableDeclarator) {
  return node.parent.kind === 'let' || node.parent.kind === 'var'
}
