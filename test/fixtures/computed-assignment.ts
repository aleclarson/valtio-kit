export const AudioPlayer = createClass((src: string) => {
  const audio = new HTMLAudioElement()
  audio.src = computed(() => src)

  // Make the `src` parameter reactive.
  onUpdate<typeof AudioPlayer>((...args) => ([src] = args))

  return {}
})
