<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => `${t('tools.title')} - SoT Reputations`
})

// Catalogue des outils : chaque outil est une sous-page /tools/<slug>.
// Pour en ajouter un : créer app/pages/tools/<slug>.vue et l'ajouter ici.
interface Tool {
  to: string
  icon: string
  titleKey: string
  descriptionKey: string
}

const tools: Tool[] = [
  { to: '/tools/fishing', icon: 'i-lucide-fish', titleKey: 'tools.fishing.title', descriptionKey: 'tools.fishing.description' },
  { to: '/tools/fireworks', icon: 'i-lucide-sparkles', titleKey: 'tools.fireworks.title', descriptionKey: 'tools.fireworks.description' }
]
</script>

<template>
  <UContainer class="py-8 max-w-5xl">
    <div class="mb-8">
      <h1 class="text-4xl font-pirate">
        {{ $t('tools.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ $t('tools.subtitle') }}
      </p>
    </div>

    <div
      v-if="tools.length"
      class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <NuxtLink
        v-for="tool in tools"
        :key="tool.to"
        :to="tool.to"
      >
        <UCard class="h-full transition hover:ring-primary hover:ring-2">
          <div class="flex items-start gap-3">
            <UIcon
              :name="tool.icon"
              class="size-8 text-primary shrink-0"
            />
            <div>
              <h2 class="font-semibold text-lg">
                {{ $t(tool.titleKey) }}
              </h2>
              <p class="text-sm text-muted mt-1">
                {{ $t(tool.descriptionKey) }}
              </p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <UCard v-else>
      <div class="flex flex-col items-center text-center py-12 gap-3">
        <UIcon
          name="i-lucide-wrench"
          class="size-12 text-muted"
        />
        <p class="font-semibold">
          {{ $t('tools.empty') }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('tools.emptyHint') }}
        </p>
      </div>
    </UCard>
  </UContainer>
</template>
