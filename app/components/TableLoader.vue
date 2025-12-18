<script setup lang="ts">
const props = defineProps<{
  minHeight?: string
  maxHeight?: string
  stickyHeader?: boolean
}>()

const container = ref<HTMLElement | null>(null)
const isVisible = ref(false)

onMounted(() => {
  if (!container.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting) {
        isVisible.value = true
        observer.disconnect()
      }
    },
    {
      rootMargin: '200px' // Charger un peu avant d'être visible
    }
  )

  observer.observe(container.value)

  onUnmounted(() => {
    observer.disconnect()
  })
})
</script>

<template>
  <div
    ref="container"
    class="table-loader"
    :class="{ 'sticky-header': props.stickyHeader }"
    :style="{
      minHeight: !isVisible ? (props.minHeight || '100px') : undefined,
      maxHeight: props.maxHeight,
      overflowY: props.maxHeight ? 'auto' : undefined
    }"
  >
    <slot v-if="isVisible" />
    <div
      v-else
      class="flex items-center justify-center py-4 text-muted"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-5 h-5 animate-spin"
      />
    </div>
  </div>
</template>

<style scoped>
.table-loader {
  content-visibility: auto;
  contain-intrinsic-size: auto 300px;
}

.sticky-header :deep(thead th) {
  position: sticky;
  top: 0;
  background-color: var(--ui-bg);
  z-index: 10;
}
</style>
