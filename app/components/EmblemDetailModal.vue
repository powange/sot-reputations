<script setup lang="ts">
interface EmblemDetail {
  id: number
  name: string
  description: string
  image: string | null
  maxGrade: number
  highSeasOnly: boolean
  gradeThresholds: Array<{ grade: number, threshold: number }>
  progress: { value: number, threshold: number, grade: number, completed: boolean } | null
}

const props = defineProps<{ emblemId: number | null }>()
const open = defineModel<boolean>('open', { default: false })
const { locale } = useI18n()

const detail = ref<EmblemDetail | null>(null)
const loading = ref(false)
const error = ref(false)

// Charge le détail à l'ouverture (ou au changement d'emblème), avec cache simple.
watch([open, () => props.emblemId], async ([isOpen, id]) => {
  if (!isOpen || !id) return
  if (detail.value?.id === id) return
  loading.value = true
  error.value = false
  detail.value = null
  try {
    detail.value = await $fetch<EmblemDetail>(`/api/emblems/${id}/detail`, { query: { locale: locale.value } })
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

// Grade effectif : un emblème complété mono-grade renvoie Grade 0 -> on affiche 1.
const effectiveGrade = computed(() => {
  const p = detail.value?.progress
  if (!p) return 0
  return (p.completed && p.grade === 0) ? 1 : p.grade
})

function thresholdFor(grade: number): number | undefined {
  return detail.value?.gradeThresholds.find(g => g.grade === grade)?.threshold
}
</script>

<template>
  <UModal v-model:open="open">
    <template #content>
      <div class="p-4 max-h-[85vh] overflow-y-auto">
        <div
          v-if="loading"
          class="py-10 flex justify-center text-muted"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="w-6 h-6 animate-spin"
          />
        </div>
        <div
          v-else-if="error || !detail"
          class="py-10 text-center text-muted"
        >
          {{ $t('yourChest.emblemModal.error') }}
        </div>
        <div
          v-else
          class="flex flex-col items-center"
        >
          <img
            v-if="detail.image"
            :src="detail.image"
            :alt="detail.name"
            class="w-24 h-24 object-contain"
          >
          <p class="mt-3 text-lg font-medium text-center">
            {{ detail.name }}
          </p>
          <p
            v-if="detail.description"
            class="mt-1 text-sm text-muted text-center max-w-md"
          >
            {{ detail.description }}
          </p>

          <UBadge
            v-if="detail.highSeasOnly"
            color="primary"
            variant="subtle"
            icon="i-lucide-waves"
            class="mt-2"
            :label="$t('reputations.highSeasOnly')"
          />

          <!-- Progression de l'utilisateur -->
          <div class="mt-4 w-full max-w-sm border-t border-muted/20 pt-3">
            <p class="text-sm font-medium mb-2">
              {{ $t('yourChest.emblemModal.progress') }}
            </p>
            <template v-if="detail.progress">
              <div class="flex items-center gap-2 text-sm">
                <UIcon
                  :name="detail.progress.completed ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
                  :class="detail.progress.completed ? 'text-success' : 'text-warning'"
                  class="w-4 h-4 shrink-0"
                />
                <span>{{ detail.progress.completed ? $t('yourChest.emblemModal.completed') : $t('yourChest.emblemModal.notCompleted') }}</span>
                <span
                  v-if="detail.maxGrade >= 2"
                  class="text-muted"
                >· {{ $t('reputations.grade') }} {{ effectiveGrade }} / {{ detail.maxGrade }}</span>
              </div>
              <div
                v-if="detail.progress.threshold > 0"
                class="text-sm text-muted mt-1"
              >
                {{ detail.progress.value }} / {{ detail.progress.threshold }}
              </div>
            </template>
            <p
              v-else
              class="text-sm text-muted"
            >
              {{ $t('yourChest.emblemModal.noProgress') }}
            </p>
          </div>

          <!-- Paliers de grade -->
          <div
            v-if="detail.maxGrade >= 2 && detail.gradeThresholds.length"
            class="mt-4 w-full max-w-sm border-t border-muted/20 pt-3"
          >
            <p class="text-sm font-medium mb-2">
              {{ $t('yourChest.emblemModal.grades') }}
            </p>
            <ul class="space-y-0.5 text-sm">
              <li
                v-for="grade in detail.maxGrade"
                :key="grade"
                class="flex justify-between gap-4"
                :class="grade === effectiveGrade ? 'font-medium text-primary' : ''"
              >
                <span class="text-muted">{{ $t('reputations.grade') }} {{ grade }}</span>
                <span>{{ thresholdFor(grade) ?? '?' }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
