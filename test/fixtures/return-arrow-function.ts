import { createClass } from 'valtio-kit'

export const Counter = createClass(() => {
  let status: string | null = null

  return () => ({
    status,
    setStatus(newStatus: string) {
      status = newStatus
    },
    reset() {
      status = null
    },
  })
})
