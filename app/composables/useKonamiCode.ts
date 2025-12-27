// Konami Code: ↑ ↑ ↓ ↓ ← → ← → B A
// On utilise event.key pour les lettres (indépendant du layout clavier)
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp',
  'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight',
  'ArrowLeft', 'ArrowRight',
  'b', 'a'
]

export function useKonamiCode(callback: () => void) {
  const currentIndex = ref(0)

  function handleKeyDown(event: KeyboardEvent) {
    const expectedKey = KONAMI_CODE[currentIndex.value]
    const pressedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key

    if (pressedKey === expectedKey) {
      currentIndex.value++

      if (currentIndex.value === KONAMI_CODE.length) {
        callback()
        currentIndex.value = 0
      }
    } else {
      currentIndex.value = pressedKey === KONAMI_CODE[0] ? 1 : 0
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })

  return {
    reset: () => { currentIndex.value = 0 }
  }
}
