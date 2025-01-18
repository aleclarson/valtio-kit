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

  const constructors: (
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression
  )[] = []
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
      (node.arguments[0].type === T.ArrowFunctionExpression ||
        node.arguments[0].type === T.FunctionExpression)
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

    const scopes = new Map<TSESTree.Node, BlockScope>()
    const findClosestScope = (node: TSESTree.Node) => {
      const scopeNode = findParentNode(node, isBlockNode) ?? root
      return scopeNode
        ? (scopes.get(scopeNode) ?? trackScope(scopeNode))
        : undefined
    }
    const trackScope = (node: TSESTree.Node) => {
      // Find parent scope within the root scope.
      const parentBlock =
        node !== root ? (findParentNode(node, isBlockNode) ?? root) : undefined

      // Collect all variables/parameters in the block.
      const scope: BlockScope = {
        node,
        names: [],
        parent: parentBlock
          ? (scopes.get(parentBlock) ?? trackScope(parentBlock))
          : undefined,
      }

      scopes.set(node, scope)

      const onIdentifier = (node: TSESTree.Identifier) => {
        scope.names.push(node.name)
      }

      // Collect all variables/parameters declared in the block.
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

      return scope
    }

    const isGlobalCallTo = (
      node: TSESTree.CallExpression | TSESTree.NewExpression,
      name: string
    ) => {
      if (!hasCalleeNamed(node, name)) {
        return false
      }
      const scope = findClosestScope(node)
      return !!scope && !findBindingFromScope(name, scope)
    }

    // A “root variable” is a variable that is eligible for reactivity. It may
    // be declared in a nested scope, but not a nested function or loop.
    const rootVariables = findRootVariables(root, isGlobalCallTo)

    const proxies = new Map<
      string,
      | TSESTree.ObjectExpression
      | TSESTree.ArrayExpression
      | TSESTree.NewExpression
    >()
    const unnestedProxies = new Set<string>()
    const watchCallbacks = new Set<TSESTree.Node>()
    const watchedIdentifiers = new Set<TSESTree.Identifier>()

    const isBeingWatched = (
      node: TSESTree.Identifier,
      stopNode?: TSESTree.Node
    ) => {
      const watchCallback = findParentNode(
        node,
        parent => watchCallbacks.has(parent),
        stopNode
      )
      return Boolean(watchCallback && !isBeingAssigned(node, watchCallback))
    }

    const isRootScope = (scope: BlockScope) => {
      return (
        scope.parent === undefined ||
        (scope.node.type === T.BlockStatement &&
          scope.parent.parent === undefined)
      )
    }

    const isInNestedFunctionScope = (scope: BlockScope | undefined) => {
      while (scope && !isRootScope(scope)) {
        if (isFunctionNode(scope.node)) {
          return true
        }
        scope = scope.parent
      }
      return false
    }

    const isRootReference = (node: TSESTree.Identifier) => {
      const scope = findClosestScope(node)!
      return findBindingFromScope(node.name, scope, isRootScope)
    }

    /**
     * Find the variable referenced by this identifier, and return the
     * `RootVariable` it belongs to (if any).
     */
    const matchRootVariable = (identifier: TSESTree.Identifier) => {
      const rootVariable = rootVariables.get(identifier.name)
      if (!rootVariable) {
        return
      }
      let scope = findClosestScope(identifier)
      while (scope) {
        if (scope.names.includes(identifier.name)) {
          return scope.node === rootVariable.scope ? rootVariable : undefined
        }
        scope = scope.parent
      }
    }

    const isProxyReference = (node: TSESTree.Identifier) =>
      proxies.has(node.name) && isRootReference(node)

    const isReactiveAssignment = (
      node: TSESTree.AssignmentExpression | TSESTree.VariableDeclarator
    ): node is
      | TSESTree.AssignmentExpression
      | (TSESTree.VariableDeclarator & { id: TSESTree.Identifier }) => {
      const refs = getLeftReferences(node)
      return refs.length > 0 && refs.every(isRootReference)
    }

    const enter = (node: TSESTree.Node, parent: TSESTree.Node | undefined) => {
      if (node.type === T.Identifier) {
        if (!parent) return

        if (parent.type === T.MemberExpression && node === parent.property) {
          // Ignore property access.
          return
        }

        if (isPurelyBeingDeclared(node)) {
          // Ignore declarations.
          return
        }

        // Handle assignments to root variables (or their properties).
        const assignment = findAssignment(node)
        if (assignment && getLeftReferences(assignment).includes(node)) {
          const rootVariable = matchRootVariable(node)
          if (rootVariable) {
            rootVariable.references.add(node)

            // Only direct assignments within a nested function scope will cause
            // a root variable to be made reactive.
            if (parent.type !== T.MemberExpression) {
              const scope = findClosestScope(node)!
              if (isInNestedFunctionScope(scope)) {
                rootVariable.reactive = true
              }
            }
          }
          return
        }

        if (
          parent.type === T.Property &&
          parent.parent.type === T.ObjectExpression
        ) {
          const objectLiteral = parent.parent
          const scope = findClosestScope(objectLiteral)!
          const returnStmt = findParentNode(
            objectLiteral,
            parent =>
              parent.type === T.ReturnStatement ||
              parent.type === T.CallExpression,
            scope.node
          )

          if (
            returnStmt?.type === T.ReturnStatement &&
            !isInNestedFunctionScope(scope)
          ) {
            // Allow reactive variables to be returned, where createClass can
            // subscribe to them.
            const rootVariable = matchRootVariable(node)
            rootVariable?.objectsContainedBy.add(objectLiteral)
            return
          }
        }

        if (isBeingWatched(node, root)) {
          watchedIdentifiers.add(node)
        }

        // Collect references to possibly reactive variables.
        const rootVariable = matchRootVariable(node)
        if (rootVariable) {
          if (
            node.parent.type === T.CallExpression &&
            node === node.parent.arguments[0] &&
            isGlobalCallTo(node.parent, 'subscribe')
          ) {
            // When a root variable is subscribed to, it becomes reactive. This
            // prevents a runtime error. We also don't unbox the atom in this
            // case.
            rootVariable.reactive = true
          } else {
            rootVariable.references.add(node)
          }
        }
      }
      // Wrap object/array literals in $proxy if being assigned to a reactive variable.
      else if (
        node.type === T.ObjectExpression ||
        node.type === T.ArrayExpression
      ) {
        const scope = findClosestScope(node)!
        if (isInNestedFunctionScope(scope)) {
          // Ignore object/array literals inside function bodies.
          return
        }

        const context = findParentNode(
          node,
          parent =>
            parent.type === T.Property ||
            parent.type === T.ArrayExpression ||
            parent.type === T.VariableDeclarator ||
            parent.type === T.CallExpression,
          scope.node
        )

        // Ignore object/array literals that are nested in another object/array
        // literal, or ignore them if passed into a function call.
        if (
          context?.type === T.VariableDeclarator &&
          context.id.type === T.Identifier
        ) {
          proxies.set(context.id.name, node)
        }

        // Wrap object literals in $unnest if they contain computed properties.
        if (node.type === T.ObjectExpression) {
          const computedProperty = node.properties.find(
            property =>
              property.type === T.Property &&
              property.value.type === T.CallExpression &&
              hasCalleeNamed(property.value, 'computed')
          ) as TSESTree.Property | undefined

          if (computedProperty) {
            imports.add('$unnest')
            result.prependLeft(node.range[0], '$unnest(')
            result.appendRight(node.range[1], ')')

            if (
              context?.type === T.VariableDeclarator &&
              context.id.type === T.Identifier
            ) {
              unnestedProxies.add(context.id.name)
            }
          }
        }
      }
      // The factory function must return an object literal.
      else if (node.type === T.ReturnStatement) {
        const scope = findClosestScope(node)!
        if (isInNestedFunctionScope(scope)) {
          // Ignore return statements inside function bodies.
          return
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

        if (proxyFunc && isGlobalCallTo(node, node.callee.name)) {
          const assignment = findParentNode(
            node,
            parent =>
              parent.type === T.VariableDeclarator ||
              parent.type === T.AssignmentExpression ||
              parent.type === T.CallExpression
          ) as
            | TSESTree.VariableDeclarator
            | TSESTree.AssignmentExpression
            | TSESTree.CallExpression
            | undefined

          if (!assignment || assignment.type === T.CallExpression) {
            return
          }

          // Skip the transform if not being assigned to a root-level variable.
          if (isReactiveAssignment(assignment)) {
            if (assignment.type === T.VariableDeclarator) {
              proxies.set(assignment.id.name, node)
            }

            imports.add(proxyFunc)

            // Remove the 'new' keyword.
            result.remove(node.range[0], node.callee.range[0])

            // Overwrite the callee with the proxy function.
            result.overwrite(...node.callee.range, proxyFunc)
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
          }
        }
      }
      // Scope tracking
      else if (isBlockNode(node) && !scopes.has(node)) {
        trackScope(node)
      }
    }

    simpleTraverse(root.body, { enter }, true)

    for (const rootVariable of rootVariables.values()) {
      if (!rootVariable.reactive) {
        continue
      }

      transformReactiveVariable(rootVariable, result, imports)

      for (const id of rootVariable.references) {
        let prefix = ''
        let suffix = ''

        if (isBeingWatched(id, root)) {
          prefix = '$get('
          suffix = ')'
        }

        const { parent } = id
        if (
          parent.type === T.Property &&
          id === parent.value &&
          id.range[0] === parent.key.range[0]
        ) {
          suffix = ': ' + prefix + id.name + suffix
          prefix = ''
        }

        if (prefix) {
          result.prependRight(id.range[0], prefix)
        }
        result.appendLeft(id.range[1], suffix + '.value')
      }

      // Object literals are wrapped with `unnest(…)` except for the topmost
      // object literal, which is handled by createClass.
      for (const objectLiteral of rootVariable.objectsContainedBy) {
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

    for (const [name, node] of proxies) {
      if (node.type === T.NewExpression) {
        // While new Map/Set objects *can be* proxies, they've already been
        // transformed by now.
        continue
      }
      // Both $atom and $unnest have the same effect on object/array literals as
      // $proxy has, so it would be redundant to add $proxy here.
      const rootVariable = rootVariables.get(name)
      if (!rootVariable?.reactive && !unnestedProxies.has(name)) {
        imports.add('$proxy')
        result.prependLeft(node.range[0], '$proxy(')
        result.appendRight(node.range[1], ')')
      }
    }

    for (const id of watchedIdentifiers) {
      const rootVariable = rootVariables.get(id.name)
      if (!rootVariable?.reactive && isProxyReference(id)) {
        result.appendLeft(id.range[0], '$get(')
        result.appendLeft(id.range[1], ')')
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

const ASTLoopTypes = [
  T.ForStatement,
  T.ForInStatement,
  T.ForOfStatement,
  T.WhileStatement,
  T.DoWhileStatement,
] as const

const ASTFunctionTypes = [
  T.ArrowFunctionExpression,
  T.FunctionDeclaration,
  T.FunctionExpression,
] as const

const isFunctionNode = isNodeOfTypes(ASTFunctionTypes)

const isBlockNode = isNodeOfTypes([
  ...ASTLoopTypes,
  ...ASTFunctionTypes,
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

function isPurelyBeingDeclared(id: TSESTree.Identifier) {
  let { parent } = id
  if (parent.type === T.VariableDeclarator) {
    return parent.id === id
  }
  if (parent.type === T.AssignmentPattern) {
    return parent.left === id
  }
  if (isFunctionNode(parent)) {
    return parent.params.includes(id)
  }
  if (parent.type === T.Property) {
    if (parent.computed) {
      return false
    }
    if (parent.key === id) {
      return true
    }
    if (parent.parent.type === T.ObjectExpression) {
      return false
    }
    return !findAssignment(id)
  }
  if (parent.type === T.ArrayPattern) {
    return !findAssignment(id)
  }
  return false
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

function findParentScope(
  scope: BlockScope | undefined,
  filter: (scope: BlockScope) => boolean
) {
  while (scope) {
    if (filter(scope)) {
      return scope
    }
    scope = scope.parent
  }
}

function hasCalleeNamed(
  node: TSESTree.CallExpression | TSESTree.NewExpression,
  name: string
) {
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

/**
 * Find the *variable* identifier referenced by this assignment's left-hand
 * side. Property identifiers are never returned.
 */
function getLeftReferences(
  assignment:
    | TSESTree.AssignmentExpression
    | TSESTree.VariableDeclarator
    | TSESTree.UpdateExpression
): TSESTree.Identifier[] {
  let id: TSESTree.Expression | undefined
  if (assignment.type === T.VariableDeclarator) {
    id = assignment.id
  } else {
    id =
      assignment.type === T.AssignmentExpression
        ? assignment.left
        : assignment.argument

    while (id.type === T.MemberExpression) {
      id = id.object
    }
  }
  if (id.type === T.Identifier) {
    return [id]
  }
  if (id.type === T.ArrayPattern || id.type === T.ObjectPattern) {
    return collectBindings(id)
  }
  return []
}

function collectBindings(
  node: TSESTree.Parameter | TSESTree.DestructuringPattern
) {
  const bindings: TSESTree.Identifier[] = []
  findBindingsInDeclarator(node, id => void bindings.push(id))
  return bindings
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

type BlockScope = {
  node: TSESTree.Node
  names: string[]
  parent: BlockScope | undefined
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

function findAssignment(id: TSESTree.Identifier) {
  let child: TSESTree.Node | undefined
  let parent: TSESTree.Node | undefined = id.parent
  while (parent) {
    if (
      parent.type === T.AssignmentExpression ||
      parent.type === T.UpdateExpression
    ) {
      return parent
    }
    if (parent.type === T.AssignmentPattern && parent.left !== child) {
      return
    }
    if (
      parent.type !== T.ObjectPattern &&
      parent.type !== T.ArrayPattern &&
      parent.type !== T.Property &&
      parent.type !== T.AssignmentPattern
    ) {
      return
    }
    child = parent
    parent = parent.parent
  }
}

function isReassignable(node: TSESTree.VariableDeclarator) {
  return node.parent.kind === 'let' || node.parent.kind === 'var'
}

type RootVariable = {
  id: TSESTree.Identifier
  scope: TSESTree.Node
  isParam: boolean
  reactive: boolean
  objectsContainedBy: Set<TSESTree.ObjectExpression>
  references: Set<TSESTree.Identifier>
}

function findRootVariables(
  root: TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  isGlobalCallTo: (node: TSESTree.CallExpression, name: string) => boolean
) {
  const rootVariables = new Map<string, RootVariable>()

  const addRootVariables = (
    node: TSESTree.Parameter | TSESTree.DestructuringPattern,
    scope: TSESTree.Node,
    isParam: boolean
  ) => {
    findBindingsInDeclarator(node, id => {
      rootVariables.set(id.name, {
        id,
        scope,
        isParam,
        reactive: false,
        objectsContainedBy: new Set(),
        references: new Set(),
      })
    })
  }

  const findRootVariables = (node: TSESTree.Node, scope: TSESTree.Node) => {
    if (node.type === T.VariableDeclaration) {
      if (node.kind === 'const') {
        for (const decl of node.declarations) {
          if (
            decl.id.type === T.Identifier &&
            decl.init?.type === T.CallExpression &&
            isGlobalCallTo(decl.init, 'computed')
          ) {
            rootVariables.set(decl.id.name, {
              id: decl.id,
              scope,
              isParam: false,
              reactive: true,
              objectsContainedBy: new Set(),
              references: new Set(),
            })
          }
        }
        return
      }
      if (node.kind !== 'let' && node.kind !== 'var') {
        return
      }
      for (const decl of node.declarations) {
        addRootVariables(decl.id, scope, false)
      }
    } else if (node.type === T.IfStatement) {
      const { consequent, alternate } = node
      if (consequent.type === T.BlockStatement) {
        for (const node of consequent.body) {
          findRootVariables(node, consequent)
        }
      }
      if (alternate?.type === T.BlockStatement) {
        for (const node of alternate.body) {
          findRootVariables(node, alternate)
        }
      }
    } else if (node.type === T.SwitchStatement) {
      for (const switchCase of node.cases) {
        for (const node of switchCase.consequent) {
          findRootVariables(node, scope)
        }
      }
    } else if (node.type === T.BlockStatement) {
      const block = node
      for (const node of block.body) {
        findRootVariables(node, block)
      }
    }
  }

  for (const param of root.params) {
    addRootVariables(param, root, true)
  }

  if (root.body.type === T.BlockStatement) {
    for (const node of root.body.body) {
      findRootVariables(node, root.body)
    }
  }

  return rootVariables
}

function transformReactiveVariable(
  variable: RootVariable,
  result: MagicString,
  imports: Set<string>
) {
  if (variable.isParam) {
    const factoryFunc = variable.scope as
      | TSESTree.ArrowFunctionExpression
      | TSESTree.FunctionExpression

    // Dynamic parameters are re-assigned with `foo = $atom(foo)` at the start
    // of the factory function body.
    if (factoryFunc.body.type === T.BlockStatement) {
      const name = variable.id.name
      result.appendLeft(
        factoryFunc.body.range[0] + 1,
        `\n  ${name} = $atom(${name});`
      )
      imports.add('$atom')
    }
  }
  // Handle variables declared with `let` or `var`.
  else if (variable.id.parent.type === T.VariableDeclarator) {
    const variableDeclarator = variable.id.parent

    imports.add('$atom')
    if (variableDeclarator.init) {
      result.prependLeft(variableDeclarator.init.range[0], '$atom(')
      result.appendRight(variableDeclarator.init.range[1], ')')
    } else {
      result.appendLeft(variable.id.range[1], ` = $atom()`)
    }
  }
  // Handle variables declared with destructuring.
  else {
    const variableDeclarator = findParentNode(
      variable.id,
      parent => parent.type === T.VariableDeclarator,
      variable.scope
    ) as TSESTree.VariableDeclarator | undefined

    if (variableDeclarator) {
      const name = variable.id.name
      imports.add('$atom')
      result.appendLeft(
        variableDeclarator.parent.range[1],
        ` ${name} = $atom(${name});`
      )
    }
  }
}
