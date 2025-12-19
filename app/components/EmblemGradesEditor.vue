<script setup lang="ts">
interface Emblem {
  id: number
  name: string
  maxGrade: number
}

const props = defineProps<{
  emblem: Emblem
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()

const isLoading = ref(true)
const isSaving = ref(false)
const error = ref<string | null>(null)

// Tableau des seuils pour chaque grade (index 0 = grade 1)
const thresholds = ref<(number | null)[]>([])

// Charger les seuils existants
async function loadGrades() {
  isLoading.value = true
  error.value = null

  try {
    const data = await $fetch<Array<{ grade: number; threshold: number }>>(
      `/api/admin/emblems/${props.emblem.id}/grades`
    )

    // Initialiser le tableau avec null pour chaque grade
    const values: (number | null)[] = Array(props.emblem.maxGrade).fill(null)

    // Remplir avec les valeurs existantes
    for (const { grade, threshold } of data) {
      if (grade >= 1 && grade <= props.emblem.maxGrade) {
        values[grade - 1] = threshold
      }
    }

    thresholds.value = values
  }
  catch (e) {
    error.value = t('components.gradeEditor.loadError')
    console.error(e)
  }
  finally {
    isLoading.value = false
  }
}

// Sauvegarder les seuils
async function save() {
  isSaving.value = true
  error.value = null

  try {
    const grades = thresholds.value.map((threshold, index) => ({
      grade: index + 1,
      threshold
    }))

    await $fetch(`/api/admin/emblems/${props.emblem.id}/grades`, {
      method: 'PUT',
      body: { grades }
    })

    emit('saved')
    emit('close')
  }
  catch (e) {
    error.value = t('components.gradeEditor.saveError')
    console.error(e)
  }
  finally {
    isSaving.value = false
  }
}

// Charger au montage
onMounted(() => {
  loadGrades()
})
</script>

<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h3 class="text-lg font-semibold">
          {{ emblem.name }}
        </h3>
        <p class="text-sm text-muted">
          {{ emblem.maxGrade }} {{ $t('reputations.grade') }}{{ emblem.maxGrade > 1 ? 's' : '' }}
        </p>
      </div>
      <UButton
        icon="i-lucide-x"
        variant="ghost"
        color="neutral"
        @click="emit('close')"
      />
    </div>

    <!-- Chargement -->
    <div v-if="isLoading" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-2" class="w-6 h-6 animate-spin text-muted" />
    </div>

    <!-- Erreur -->
    <UAlert
      v-else-if="error"
      color="error"
      :title="error"
      class="mb-4"
    />

    <!-- Formulaire -->
    <div v-else class="space-y-4">
      <div
        v-for="(_, index) in thresholds"
        :key="index"
        class="flex items-center gap-4"
      >
        <span class="text-sm font-medium w-20">{{ $t('reputations.grade') }} {{ index + 1 }}</span>
        <UInput
          v-model.number="thresholds[index]"
          type="number"
          :placeholder="$t('components.gradeEditor.threshold')"
          class="flex-1"
          :min="0"
        />
      </div>

      <div class="flex justify-end gap-2 pt-4 border-t border-muted/30">
        <UButton
          variant="ghost"
          color="neutral"
          :disabled="isSaving"
          @click="emit('close')"
        >
          {{ $t('common.cancel') }}
        </UButton>
        <UButton
          color="primary"
          :loading="isSaving"
          @click="save"
        >
          {{ $t('common.save') }}
        </UButton>
      </div>
    </div>
  </div>
</template>
