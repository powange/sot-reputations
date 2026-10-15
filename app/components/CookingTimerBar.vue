<script setup lang="ts">
// Barre d'un minuteur de cuisson : cru → pas assez cuit → cuit → brûlé, + état et décompte.
const props = defineProps<{ timer: CookingTimer }>()
const { stageOf, progress, statusText } = useCookingTimers()

const times = computed(() => COOKING_TIMES[props.timer.food])
// Segments en % de la durée jusqu'à « brûlé »
const segments = computed(() => {
  const { undercooked, cooked, burnt } = times.value
  return {
    raw: (undercooked / burnt) * 100,
    undercooked: ((cooked - undercooked) / burnt) * 100,
    cooked: ((burnt - cooked) / burnt) * 100
  }
})
const stage = computed(() => stageOf(props.timer))
</script>

<template>
  <div>
    <div class="relative h-2.5 rounded-full overflow-hidden flex bg-elevated">
      <div
        class="bg-neutral-300 dark:bg-neutral-600"
        :style="{ width: `${segments.raw}%` }"
      />
      <div
        class="bg-pink-300 dark:bg-pink-700"
        :style="{ width: `${segments.undercooked}%` }"
      />
      <div
        class="bg-green-400 dark:bg-green-600"
        :style="{ width: `${segments.cooked}%` }"
      />
      <div
        class="absolute inset-y-0 left-0 bg-black/35 dark:bg-white/35"
        :style="{ width: `${progress(timer)}%` }"
      />
    </div>
    <p class="text-xs mt-1 tabular-nums flex flex-wrap gap-x-2">
      <span
        class="font-semibold"
        :class="COOKING_STAGE_CLASSES[stage]"
      >{{ $t(`tools.fishing.cooking.stage.${stage}`) }}</span>
      <span class="text-muted">{{ statusText(timer) }}</span>
    </p>
  </div>
</template>
