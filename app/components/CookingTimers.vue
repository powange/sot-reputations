<script setup lang="ts">
// Panneau des minuteurs de cuisson du guide (logique partagée : useCookingTimers).
const {
  timers, soundOn, notifPermission, stageOf, nameOf, imageOf,
  start, restart, remove, clearAll, toggleSound, enableNotifications
} = useCookingTimers()
</script>

<template>
  <UCard>
    <div class="flex flex-wrap items-center justify-between gap-2 mb-1">
      <h3 class="font-semibold text-lg flex items-center gap-2">
        <UIcon
          name="i-lucide-timer"
          class="size-5 text-primary"
        />
        {{ $t('tools.fishing.cooking.timers.title') }}
      </h3>
      <div class="flex flex-wrap gap-1">
        <UButton
          v-if="notifPermission === 'default'"
          icon="i-lucide-bell"
          size="sm"
          variant="ghost"
          color="neutral"
          :label="$t('tools.fishing.cooking.timers.notifications')"
          @click="enableNotifications"
        />
        <UButton
          :icon="soundOn ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
          size="sm"
          variant="ghost"
          color="neutral"
          :aria-label="$t('tools.fishing.cooking.timers.sound')"
          :aria-pressed="soundOn"
          @click="toggleSound"
        />
      </div>
    </div>
    <p class="text-sm text-muted mb-4">
      {{ $t('tools.fishing.cooking.timers.intro') }}
    </p>

    <!-- Lancer un minuteur -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
      <UButton
        v-for="food in COOKING_FOODS"
        :key="food"
        color="neutral"
        variant="outline"
        class="flex-col h-auto py-2 gap-1"
        :disabled="timers.length >= MAX_COOKING_TIMERS"
        @click="start(food)"
      >
        <img
          :src="COOKING_FOOD_IMAGES[food]"
          alt=""
          width="40"
          height="40"
          class="size-10"
        >
        <span class="font-semibold text-sm">{{ $t(`tools.fishing.cooking.timers.food.${food}`) }}</span>
        <span class="text-xs text-muted">{{ $t(`tools.fishing.cooking.timers.foodHint.${food}`) }}</span>
      </UButton>
    </div>

    <!-- Minuteurs en cours -->
    <ul
      v-if="timers.length"
      class="space-y-3"
    >
      <li
        v-for="timer in timers"
        :key="timer.id"
        class="rounded-lg border border-default p-3"
        :class="{ 'ring-2 ring-success': stageOf(timer) === 'cooked', 'ring-2 ring-error': stageOf(timer) === 'burnt' }"
      >
        <div class="flex items-center gap-3">
          <img
            :src="imageOf(timer)"
            alt=""
            width="36"
            height="36"
            class="size-9 shrink-0"
            :class="{ 'brightness-50': stageOf(timer) === 'burnt' }"
          >
          <div class="flex-1 min-w-0">
            <span class="font-semibold">{{ nameOf(timer) }}</span>
            <CookingTimerBar
              :timer="timer"
              class="mt-1"
            />
          </div>
          <UButton
            icon="i-lucide-rotate-ccw"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="$t('tools.fishing.cooking.timers.restart')"
            @click="restart(timer)"
          />
          <UButton
            icon="i-lucide-x"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="$t('tools.fishing.cooking.timers.remove')"
            @click="remove(timer)"
          />
        </div>
      </li>
    </ul>
    <p
      v-else
      class="text-sm text-muted text-center py-2"
    >
      {{ $t('tools.fishing.cooking.timers.empty') }}
    </p>

    <div
      v-if="timers.length > 1"
      class="flex justify-end mt-3"
    >
      <UButton
        icon="i-lucide-trash-2"
        size="sm"
        variant="ghost"
        color="neutral"
        :label="$t('tools.fishing.cooking.timers.clear')"
        @click="clearAll"
      />
    </div>
  </UCard>
</template>
