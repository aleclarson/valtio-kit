import * as React from 'react'
import { setAllowAutoRetain } from '../runtime/instance'

// Do not immediately retain a reactive instance created during a render pass.
// This prevents memory leaks when a render is cancelled.
setAllowAutoRetain(() => {
  // React 19+
  let ReactSharedInternals =
    (React as any)
      .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
    (React as any)
      .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

  if (ReactSharedInternals) {
    return ReactSharedInternals.H === null
  }

  // React 18
  ReactSharedInternals = (React as any)
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED

  return ReactSharedInternals.ReactCurrentDispatcher.current === null
})

export { useSnapshot } from 'valtio/react'
export * from '../index'
export { useInstance } from './useInstance'
