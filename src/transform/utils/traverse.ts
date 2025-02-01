import type {
  AST_NODE_TYPES as NodeType,
  TSESTree,
} from '@typescript-eslint/typescript-estree'
import { visitorKeys, VisitorKeys } from '@typescript-eslint/visitor-keys'

export type VisitorEnter<T extends TSESTree.Node = TSESTree.Node> = (
  node: T,
  ctrl: NodeTraversal
) => void

export type VisitorsRecord = {
  [K in NodeType]?: VisitorEnter<Extract<TSESTree.Node, { type: K }>>
} & {
  default?: VisitorEnter
}

function isValidNode(x: unknown): x is TSESTree.Node {
  return (
    typeof x === 'object' &&
    x != null &&
    'type' in x &&
    typeof (x as TSESTree.Node).type === 'string'
  )
}

type Options = {
  enter?: VisitorEnter
  visitorKeys?: VisitorKeys
  visitors?: VisitorsRecord
}

function getVisitorKeysForNode(
  allVisitorKeys: VisitorKeys,
  node: TSESTree.Node
): readonly string[] {
  const keys = allVisitorKeys[node.type]
  return keys ?? []
}

class NodeTraversal {
  private stopped = false
  private skipped = new Set<TSESTree.Node>()
  private allVisitorKeys: VisitorKeys = visitorKeys
  private selectors: Pick<Options, 'enter' | 'visitors'>
  private nodeStack: TSESTree.Node[] = []

  constructor({ visitorKeys, ...selectors }: Options) {
    this.selectors = selectors
    if (visitorKeys) {
      this.allVisitorKeys = visitorKeys
    }
  }

  get currentNode() {
    return this.nodeStack[this.nodeStack.length - 1]
  }

  skip(node?: TSESTree.Node) {
    this.skipped.add(node ?? this.currentNode)
  }

  stop() {
    this.stopped = true
  }

  traverse(node: TSESTree.Node, parent: TSESTree.Node | undefined): void {
    if (!isValidNode(node)) {
      return
    }
    if (this.stopped || this.skipped.has(node)) {
      return
    }
    if (!node.hasOwnProperty('parent')) {
      node.parent = parent
    }
    this.nodeStack.push(node)
    visit: {
      if (this.selectors.enter) {
        this.selectors.enter(node, this)
        if (this.stopped || this.skipped.has(node)) {
          break visit
        }
      }

      const visitor = (this.selectors.visitors?.[node.type] ??
        this.selectors.visitors?.default) as VisitorEnter
      if (visitor) {
        visitor(node, this)
        if (this.stopped || this.skipped.has(node)) {
          break visit
        }
      }

      const keys = getVisitorKeysForNode(this.allVisitorKeys, node)
      for (const key of keys) {
        const childOrChildren = node[key as keyof typeof node] as
          | TSESTree.Node
          | TSESTree.Node[]
          | null
          | undefined

        if (Array.isArray(childOrChildren)) {
          for (const child of childOrChildren) {
            this.traverse(child, node)
          }
        } else if (childOrChildren) {
          this.traverse(childOrChildren, node)
        }
        if (this.stopped) {
          break visit
        }
      }
    }
    this.nodeStack.pop()
  }
}

export type Visitor = Options &
  ({ enter: VisitorEnter } | { visitors: VisitorsRecord })

export function traverse(startingNode: TSESTree.Node, visitor: Visitor): void {
  new NodeTraversal(visitor).traverse(startingNode, undefined)
}
