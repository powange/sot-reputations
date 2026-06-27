<script setup lang="ts">
const props = defineProps<{
  name: string
  description?: string
  image?: string
  emblemId?: number
}>()
const open = defineModel<boolean>('open', { default: false })

const { locale } = useI18n()

// Vue inverse : objets du coffre dont cet emblème est un prérequis (chargé à l'ouverture).
interface ChestItemRef { id: number, name: string, image: string | null, grade: number | null }
const chestItems = ref<ChestItemRef[]>([])
const itemsLoaded = ref(false)

// Réutilisé pour un autre emblème -> on reset le cache.
watch(() => props.emblemId, () => {
  itemsLoaded.value = false
  chestItems.value = []
})

watch(open, async (isOpen) => {
  if (!isOpen || !props.emblemId || itemsLoaded.value) return
  itemsLoaded.value = true
  try {
    const res = await $fetch<{ items: ChestItemRef[] }>(`/api/emblems/${props.emblemId}/chest-items`, {
      query: { locale: locale.value }
    })
    chestItems.value = res.items
  } catch {
    itemsLoaded.value = false // autorise un nouvel essai à la prochaine ouverture
  }
})
</script>

<template>
  <UModal
    v-if="image"
    v-model:open="open"
  >
    <template #content>
      <div class="p-4 flex flex-col items-center max-h-[85vh] overflow-y-auto">
        <img
          :src="image"
          :alt="name"
          class="max-w-full max-h-[45vh] sm:max-h-[60vh] object-contain"
        >
        <p class="mt-4 text-lg font-medium text-center">
          {{ name }}
        </p>
        <p
          v-if="description"
          class="mt-1 text-sm text-muted text-center max-w-md"
        >
          {{ description }}
        </p>

        <!-- Objets du coffre que cet emblème débloque (prérequis) -->
        <div
          v-if="chestItems.length"
          class="mt-4 w-full max-w-md border-t border-muted/20 pt-3"
        >
          <p class="text-sm font-medium mb-2">
            {{ $t('reputations.unlocksChestItems') }}
          </p>
          <ul class="space-y-1.5">
            <li
              v-for="it in chestItems"
              :key="it.id"
              class="flex items-center gap-2 text-sm"
            >
              <NuxtImg
                v-if="it.image"
                :src="it.image"
                :alt="it.name"
                width="40"
                height="40"
                format="webp"
                class="w-8 h-8 object-cover rounded bg-muted/20 shrink-0"
              />
              <span class="min-w-0">{{ it.name }}</span>
              <span
                v-if="it.grade"
                class="text-xs text-muted shrink-0"
              >({{ $t('reputations.grade') }} {{ it.grade }})</span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </UModal>
</template>
