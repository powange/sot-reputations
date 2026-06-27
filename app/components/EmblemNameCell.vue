<script setup lang="ts">
defineProps<{
  name: string
  description: string
  image?: string
  emblemId?: number
}>()

const isImageModalOpen = ref(false)
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

    <EmblemImageModal
      v-model:open="isImageModalOpen"
      :name="name"
      :description="description"
      :image="image"
      :emblem-id="emblemId"
    />
  </div>
</template>
