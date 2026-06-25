<script setup lang="ts">
const props = defineProps<{
  name: string
  description: string
  image?: string
  emblemId?: number
}>()

const isImageModalOpen = ref(false)

// Vue inverse : objets du coffre dont cet emblème est un prérequis (chargé à l'ouverture).
interface ChestItemRef { id: number, name: string, image: string | null, subcategory: string | null, grade: number | null }
const chestItems = ref<ChestItemRef[]>([])
const itemsLoaded = ref(false)

watch(isImageModalOpen, async (open) => {
  if (!open || !props.emblemId || itemsLoaded.value) return
  itemsLoaded.value = true
  try {
    const res = await $fetch<{ items: ChestItemRef[] }>(`/api/emblems/${props.emblemId}/chest-items`)
    chestItems.value = res.items
  } catch {
    itemsLoaded.value = false // autorise un nouvel essai à la prochaine ouverture
  }
})
</script>

<template>
  <div class="flex items-center gap-3">
    <img
      v-if="image"
      :src="image"
      :alt="name"
      class="w-10 h-10 object-contain shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
      @click="isImageModalOpen = true"
    >

    <!-- Version mobile: nom + icône info -->
    <div class="flex items-center gap-2 md:hidden min-w-0">
      <span class="font-medium">{{ name }}</span>
      <UPopover
        v-if="description"
        mode="click"
      >
        <UIcon
          name="i-lucide-info"
          class="w-4 h-4 text-muted cursor-pointer shrink-0"
        />
        <template #content>
          <div class="p-2 text-sm max-w-xs">
            {{ description }}
          </div>
        </template>
      </UPopover>
    </div>

    <!-- Version desktop: nom + description complète -->
    <div class="hidden md:block min-w-0">
      <div class="font-medium">
        {{ name }}
      </div>
      <div class="text-xs text-muted">
        {{ description }}
      </div>
    </div>

    <!-- Modal image agrandie -->
    <UModal
      v-if="image"
      v-model:open="isImageModalOpen"
    >
      <template #content>
        <div class="p-4 flex flex-col items-center">
          <img
            :src="image"
            :alt="name"
            class="max-w-full max-h-[70vh] object-contain"
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
              Débloque ces objets du coffre :
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
                >(grade {{ it.grade }})</span>
              </li>
            </ul>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
