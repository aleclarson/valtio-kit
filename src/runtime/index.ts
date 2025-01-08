// Compiler API
export { proxy as $proxy } from 'valtio'
export { proxyMap as $proxyMap, proxySet as $proxySet } from 'valtio/utils'
export { atom as $atom, unnest as $unnest } from './atom'

// Global API
export { getVersion, ref, snapshot } from 'valtio'
export * from './computed'
export * from './createState'
export * from './effects'
