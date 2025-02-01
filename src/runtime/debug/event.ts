export type ValtioTargetKind = 'variable' | 'instance' | 'proxy'

export type ValtioEvent = {
  targetId: string
  target: object
  targetKind: ValtioTargetKind
  path: readonly (string | symbol)[]
}

export type ValtioUpdate = ValtioEvent & {
  op: 'set' | 'delete'
  value: unknown
  oldValue: unknown
}

export type ValtioCall = ValtioEvent & {
  method: string
  args: unknown[]
}
