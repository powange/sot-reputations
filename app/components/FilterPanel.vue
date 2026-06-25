<script setup lang="ts">
// Filtres responsives : en ligne sur desktop, dans une modale (bouton « Filtres »)
// sur mobile pour gagner de la place. Le contenu (slot) n'est rendu qu'à UN seul
// endroit à la fois (desktop en ligne OU modale mobile) — jamais en double — pour
// éviter de monter deux fois des composants qui ont des effets de bord au montage
// (ex. ReputationFilters et son watch immédiat). L'état des filtres vit dans le
// parent (v-models), donc il persiste même quand la modale est fermée.
defineProps<{ title?: string }>()
const { t } = useI18n()
const open = ref(false)

// Breakpoint md (768px) de Tailwind. Desktop-first pour que le SSR rende les
// filtres en ligne (pas de décalage d'hydratation : l'état initial côté client
// est aussi « desktop », puis onMounted ajuste selon la largeur réelle).
const isDesktop = ref(true)
let mql: MediaQueryList | null = null
function onMqChange(e: MediaQueryListEvent) {
  isDesktop.value = e.matches
  if (e.matches) open.value = false // repasse en desktop -> referme la modale
}
onMounted(() => {
  mql = window.matchMedia('(min-width: 768px)')
  isDesktop.value = mql.matches
  mql.addEventListener('change', onMqChange)
})
onBeforeUnmount(() => mql?.removeEventListener('change', onMqChange))
</script>

<template>
  <!-- Desktop : filtres en ligne -->
  <div v-if="isDesktop">
    <slot />
  </div>

  <!-- Mobile : bouton qui ouvre la modale de filtres -->
  <div v-else>
    <div class="mb-3">
      <UButton
        icon="i-lucide-sliders-horizontal"
        :label="title || t('common.filters')"
        color="neutral"
        variant="outline"
        block
        @click="open = true"
      />
    </div>
    <UModal
      v-model:open="open"
      :title="title || t('common.filters')"
    >
      <template #content>
        <div class="flex flex-col max-h-[88vh]">
          <div class="flex items-center justify-between p-4 border-b border-muted/20">
            <span class="font-semibold">{{ title || t('common.filters') }}</span>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              @click="open = false"
            />
          </div>
          <div class="p-4 overflow-y-auto space-y-3">
            <slot />
          </div>
          <div class="p-3 border-t border-muted/20">
            <UButton
              :label="t('common.close')"
              block
              @click="open = false"
            />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
