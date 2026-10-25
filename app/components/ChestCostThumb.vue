<script setup lang="ts">
// Vignette d'un item dans l'aperçu des données wiki du coffre : image du catalogue,
// sinon celle de la page wiki rapprochée. Pastille « wiki » quand l'image affichée
// vient du wiki. Clic = image d'origine dans un nouvel onglet.
const props = defineProps<{
  image?: string | null
  wikiImage?: string | null
  alt: string
}>()

const src = computed(() => props.image || props.wikiImage || null)
const fromWiki = computed(() => isWikiImage(src.value))
</script>

<template>
  <a
    v-if="src"
    :href="src"
    target="_blank"
    rel="noopener"
    class="relative block w-10 h-10 shrink-0 rounded bg-elevated overflow-hidden"
    :title="fromWiki ? 'Image du wiki' : 'Image du site'"
    @click.stop
  >
    <ChestItemImage
      :src="src"
      :alt="alt"
      :size="40"
      densities="x1 x2"
      format="webp"
      loading="lazy"
      class="w-full h-full object-contain"
    />
    <span
      v-if="fromWiki"
      class="absolute bottom-0 inset-x-0 text-[9px] leading-3 text-center bg-info/80 text-inverted"
    >wiki</span>
  </a>
  <div
    v-else
    class="w-10 h-10 shrink-0 rounded bg-elevated"
    title="Pas d'image"
  />
</template>
