<script setup lang="ts">
// Édition des plats d'une quête de Merrick (création et modification).
const dishes = defineModel<MerrickDish[]>({ required: true })

const { t } = useI18n()
const { itemOptions } = useMerrickLabels()

const courseOptions = computed(() => MERRICK_COURSES.map(c => ({ label: t(`tools.fishing.merrick.course.${c}`), value: c })))
const stateOptions = computed(() => MERRICK_STATES.map(s => ({ label: t(`tools.fishing.merrick.state.${s}`), value: s })))

function newIngredient(): MerrickIngredient {
  return { type: 'fish', key: 'splashtail', variant: null, state: 'cooked', quantity: 1 }
}

function addDish() {
  const course = MERRICK_COURSES[Math.min(dishes.value.length, MERRICK_COURSES.length - 1)]!
  dishes.value.push({ course, name: '', ingredients: [newIngredient()] })
}

function setItem(ing: MerrickIngredient, id: string) {
  const item = parseMerrickItemId(id)
  if (item) Object.assign(ing, item)
}
</script>

<template>
  <div class="space-y-4">
    <UCard
      v-for="(dish, dishIndex) in dishes"
      :key="dishIndex"
    >
      <template #header>
        <div class="flex flex-col sm:flex-row gap-2">
          <USelect
            v-model="dish.course"
            :items="courseOptions"
            class="sm:w-44"
          />
          <UInput
            v-model="dish.name"
            :placeholder="$t('tools.fishing.merrick.dishName')"
            :maxlength="MERRICK_LIMITS.nameLength"
            class="flex-1"
          />
          <UButton
            icon="i-lucide-trash-2"
            color="error"
            variant="ghost"
            :aria-label="$t('tools.fishing.merrick.removeDish')"
            @click="dishes.splice(dishIndex, 1)"
          />
        </div>
      </template>

      <div class="space-y-2">
        <div
          v-for="(ing, ingIndex) in dish.ingredients"
          :key="ingIndex"
          class="flex flex-wrap sm:flex-nowrap items-center gap-2"
        >
          <UInputNumber
            v-model="ing.quantity"
            :min="1"
            :max="MERRICK_LIMITS.quantity"
            :aria-label="$t('tools.fishing.merrick.quantity')"
            class="w-28"
          />
          <USelectMenu
            :model-value="merrickItemId(ing)"
            :items="itemOptions"
            value-key="value"
            :placeholder="$t('tools.fishing.merrick.item')"
            class="flex-1 min-w-48"
            @update:model-value="(v: string) => setItem(ing, v)"
          />
          <USelect
            v-model="ing.state"
            :items="stateOptions"
            class="w-28"
          />
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            :aria-label="$t('tools.fishing.merrick.removeIngredient')"
            @click="dish.ingredients.splice(ingIndex, 1)"
          />
        </div>
        <UButton
          v-if="dish.ingredients.length < MERRICK_LIMITS.ingredientsPerDish"
          icon="i-lucide-plus"
          size="sm"
          variant="soft"
          :label="$t('tools.fishing.merrick.addIngredient')"
          @click="dish.ingredients.push(newIngredient())"
        />
      </div>
    </UCard>

    <UButton
      v-if="dishes.length < MERRICK_LIMITS.dishes"
      icon="i-lucide-plus"
      variant="outline"
      :label="$t('tools.fishing.merrick.addDish')"
      @click="addDish"
    />
  </div>
</template>
