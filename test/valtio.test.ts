import { proxy } from 'valtio'
import { watch } from 'valtio/utils'

test('valtio playground', () => {
  const state = proxy({
    count: 0,
  })

  watch(get => {
    console.log('count', get(state).count)
  })

  state.count = 1
})
