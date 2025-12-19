<script setup lang="ts">
import type { GradeThreshold } from '~/types/reputation'

defineProps<{
  maxThreshold: number | null
  maxGrade: number
  gradeThresholds?: GradeThreshold[]
}>()

function getThreshold(gradeThresholds: GradeThreshold[] | undefined, grade: number): number | undefined {
  return gradeThresholds?.find(g => g.grade === grade)?.threshold
}
</script>

<template>
  <template v-if="maxGrade >= 2 && gradeThresholds?.length">
    <UPopover
      mode="hover"
      :content="{
        side: 'right'
      }"
    >
      <span class="cursor-help underline decoration-dotted">
        {{ maxThreshold ?? '?' }}
      </span>
      <template #content>
        <div class="p-2 space-y-1">
          <div
            v-for="grade in maxGrade"
            :key="grade"
            class="flex justify-between gap-4 text-sm"
          >
            <span class="text-muted">{{ $t('reputations.grade') }} {{ grade }}</span>
            <span :class="getThreshold(gradeThresholds, grade) !== undefined ? 'font-medium' : 'text-muted'">
              {{ getThreshold(gradeThresholds, grade) ?? '?' }}
            </span>
          </div>
        </div>
      </template>
    </UPopover>
  </template>
  <template v-else>
    {{ maxThreshold ?? '?' }}
  </template>
</template>
