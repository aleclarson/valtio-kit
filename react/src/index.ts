import * as React from 'react'
import { setAllowAutoSetup } from 'valtio-kit/runtime'

// Do not immediately retain a reactive instance created during a render pass.
// This prevents memory leaks when a render is cancelled.
setAllowAutoSetup(() => {
  // React 19+
  let ReactSharedInternals =
    (React as any)
      .__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE ||
    (React as any)
      .__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE

  if (ReactSharedInternals) {
    const ReactCurrentDispatcher = ReactSharedInternals.H
    return (
      ReactCurrentDispatcher === null ||
      ReactCurrentDispatcher.useCallback
        .toString()
        .includes('Invalid hook call')
    )
  }

  // React 18
  ReactSharedInternals = (React as any)
    .__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED

  return ReactSharedInternals.ReactCurrentDispatcher.current === null
})

export * from 'valtio-kit'

export { useSnapshot } from 'valtio/react'
export { createContextHooks } from './context'
export { useInstance } from './useInstance'
