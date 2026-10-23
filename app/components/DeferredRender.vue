<script setup lang="ts">
// Monte le contenu seulement quand il approche du viewport, puis le garde monté.
// Un espace réservé de hauteur estimée évite que la page saute pendant le défilement.
// En SSR / hydratation, rendu immédiat (pas de mismatch d'hydratation).
const props = defineProps<{
  // Nombre d'éléments de la grille, pour estimer la hauteur de l'espace réservé.
  count: number
  itemHeight?: number
}>()

const nuxtApp = useNuxtApp()
const visible = ref(import.meta.server || nuxtApp.isHydrating)
const placeholder = ref<HTMLElement | null>(null)
const columns = ref(1)
let observer: IntersectionObserver | null = null

// Colonnes de la grille : grid-cols-1 sm:grid-cols-2 xl:grid-cols-3, gap-3 (12px).
const minHeight = computed(() => {
  const rows = Math.ceil(props.count / columns.value)
  return rows * (props.itemHeight ?? 116) + Math.max(0, rows - 1) * 12
})

onMounted(() => {
  if (visible.value || !placeholder.value) return
  const w = window.innerWidth
  columns.value = w >= 1280 ? 3 : (w >= 640 ? 2 : 1)
  observer = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      visible.value = true
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '600px 0px' })
  observer.observe(placeholder.value)
})

onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <slot v-if="visible" />
  <div
    v-else
    ref="placeholder"
    :style="{ minHeight: `${minHeight}px` }"
  />
</template>
