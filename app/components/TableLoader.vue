<script setup lang="ts">
const { minHeight } = defineProps<{
  minHeight?: string
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
    :style="{
      minHeight: !isVisible ? (minHeight || '100px') : undefined
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

/* Scroll horizontal sur mobile */
@media (max-width: 768px) {
  .table-loader {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
</style>
