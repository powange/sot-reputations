<script setup lang="ts">
// Image d'un item du coffre : NuxtImg (IPX) pour le CDN officiel ; image du wiki
// chargée directement en miniature (cf. utils/wiki-image.ts), sans passer par IPX.
defineOptions({ inheritAttrs: false })

const props = defineProps<{
  src: string
  alt: string
  // Taille d'affichage visée (px) : NuxtImg width/height, et miniature wiki en x2.
  size: number
  format?: string
  quality?: number
  densities?: string
  loading?: 'lazy' | 'eager'
  // Image en taille d'origine (ex. modale) plutôt qu'une miniature, pour le wiki.
  original?: boolean
}>()

const wiki = computed(() => isWikiImage(props.src))
const wikiSrc = computed(() => props.original ? props.src : wikiThumb(props.src, Math.min(props.size * 2, 1024)))
</script>

<template>
  <img
    v-if="wiki"
    v-bind="$attrs"
    :src="wikiSrc"
    :alt="alt"
    :loading="loading"
    decoding="async"
  >
  <NuxtImg
    v-else
    v-bind="$attrs"
    :src="src"
    :alt="alt"
    :width="size"
    :height="size"
    :format="format"
    :quality="quality"
    :densities="densities"
    :loading="loading"
  />
</template>
