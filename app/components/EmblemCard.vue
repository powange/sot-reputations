<script setup lang="ts">
import type { SingleUserTableRow } from '~/types/reputation'

const props = defineProps<{
  row: SingleUserTableRow
  // Affiche la progression de l'utilisateur (faux en public / sans import).
  showProgress: boolean
}>()

const isImageOpen = ref(false)

// État visuel : complété (vert), en cours (ambre), rien (atténué).
const stateText = computed(() =>
  props.row.completed ? 'text-success' : (props.row.hasProgress ? 'text-warning' : 'text-muted'))
const stateBar = computed(() =>
  props.row.completed ? 'bg-success' : (props.row.hasProgress ? 'bg-warning' : 'bg-muted'))
const stateIcon = computed(() =>
  props.row.completed ? 'i-lucide-circle-check' : (props.row.hasProgress ? 'i-lucide-loader' : 'i-lucide-circle-dashed'))

// Largeur de la barre = valeur / seuil max (bornée à 100%).
const pct = computed(() => {
  const max = props.row.maxThreshold
  if (!max || max <= 0) return props.row.completed ? 100 : 0
  return Math.min(100, Math.round((props.row.value / max) * 100))
})

// Grade affiché : un emblème complété mono-grade renvoie Grade 0 -> on affiche 1.
const displayGrade = computed(() =>
  (props.row.completed && props.row.grade === 0) ? 1 : props.row.grade)

const isScalar = computed(() => !!props.row.maxThreshold && props.row.maxThreshold > 0)
</script>

<template>
  <div class="border border-muted/40 rounded-lg p-3 flex flex-col gap-2 bg-elevated/30 h-full">
    <div class="flex items-start gap-3">
      <img
        v-if="row.image"
        :src="row.image"
        :alt="row.name"
        class="w-12 h-12 object-contain shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
        @click="isImageOpen = true"
      >
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <span class="font-medium leading-tight">{{ row.name }}</span>
          <UIcon
            v-if="showProgress"
            :name="stateIcon"
            :class="stateText"
            class="w-4 h-4 shrink-0 mt-0.5"
          />
        </div>
        <p
          v-if="row.description"
          class="text-xs text-muted mt-0.5 line-clamp-2"
        >
          {{ row.description }}
        </p>
      </div>
    </div>

    <!-- Pied : progression (utilisateur) ou paliers (public) -->
    <div class="mt-auto pt-1">
      <template v-if="showProgress && isScalar">
        <div class="h-1.5 rounded-full bg-muted/30 overflow-hidden">
          <div
            class="h-full rounded-full transition-all"
            :class="stateBar"
            :style="{ width: pct + '%' }"
          />
        </div>
        <div class="flex items-center justify-between text-xs mt-1">
          <span :class="stateText">
            {{ row.value }} / <MaxThresholdCell
              :max-threshold="row.maxThreshold"
              :max-grade="row.maxGrade"
              :grade-thresholds="row.gradeThresholds"
            />
          </span>
          <span
            v-if="row.maxGrade >= 2"
            class="text-muted"
          >{{ $t('reputations.grade') }} {{ displayGrade }}/{{ row.maxGrade }}</span>
        </div>
      </template>

      <!-- Emblème binaire avec progression utilisateur -->
      <template v-else-if="showProgress">
        <span
          class="text-xs font-medium"
          :class="stateText"
        >{{ row.completed ? $t('reputations.yes') : $t('reputations.no') }}</span>
      </template>

      <!-- Public : pas de progression, on montre les paliers -->
      <div
        v-else-if="row.maxThreshold"
        class="text-xs text-muted flex items-center gap-1"
      >
        <span>{{ $t('reputations.max') }} :</span>
        <MaxThresholdCell
          :max-threshold="row.maxThreshold"
          :max-grade="row.maxGrade"
          :grade-thresholds="row.gradeThresholds"
        />
      </div>
    </div>

    <EmblemImageModal
      v-model:open="isImageOpen"
      :name="row.name"
      :description="row.description"
      :image="row.image"
      :emblem-id="row.id"
    />
  </div>
</template>
