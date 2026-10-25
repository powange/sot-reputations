<script setup lang="ts">
// Vignette d'un item dans l'aperçu des données wiki du coffre : image du catalogue,
// sinon celle de la page wiki rapprochée. Pastille « wiki » quand l'image affichée
// vient du wiki. Clic = image en grand dans une modale.
const props = defineProps<{
  image?: string | null
  wikiImage?: string | null
  alt: string
}>()

const src = computed(() => props.image || props.wikiImage || null)
const fromWiki = computed(() => isWikiImage(src.value))

const isOpen = ref(false)
// Modale montée au premier clic seulement (une vignette par ligne de l'aperçu).
const modalMounted = ref(false)

function open() {
  modalMounted.value = true
  isOpen.value = true
}
</script>

<template>
  <!-- prevent : la vignette peut être dans le <label> d'une case à cocher -->
  <button
    v-if="src"
    type="button"
    class="relative block w-10 h-10 shrink-0 rounded bg-elevated overflow-hidden cursor-zoom-in"
    :title="fromWiki ? 'Image du wiki' : 'Image du site'"
    :aria-label="`Agrandir l'image : ${alt}`"
    @click.prevent.stop="open"
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
  </button>
  <div
    v-else
    class="w-10 h-10 shrink-0 rounded bg-elevated"
    title="Pas d'image"
  />

  <UModal
    v-if="src && modalMounted"
    v-model:open="isOpen"
    :title="alt"
    :description="fromWiki ? 'Image du wiki Sea of Thieves' : 'Image du site officiel'"
  >
    <template #body>
      <div class="flex justify-center">
        <ChestItemImage
          :src="src"
          :alt="alt"
          :size="512"
          format="webp"
          :quality="90"
          :original="fromWiki"
          class="max-w-full max-h-[60vh] object-contain"
        />
      </div>
    </template>
  </UModal>
</template>
