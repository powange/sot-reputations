<script setup lang="ts">
// Édition des plats d'une quête de Merrick (création et modification). Les ingrédients se
// déplacent par glisser-déposer (poignée), dans le même plat ou vers un autre plat.
import type Sortable from 'sortablejs'
import type { ComponentPublicInstance } from 'vue'

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

// Clés stables par objet : après un déplacement, Vue doit suivre l'ingrédient, pas sa position
const uids = new WeakMap<object, number>()
let nextUid = 0
function uid(obj: object): number {
  if (!uids.has(obj)) uids.set(obj, nextUid++)
  return uids.get(obj)!
}

// --- Glisser-déposer (SortableJS : souris et tactile) ---
const sortables = new Map<HTMLElement, Sortable>()

async function bindSortable(el: Element | ComponentPublicInstance | null) {
  if (!(el instanceof HTMLElement) || sortables.has(el)) return
  const { default: SortableJS } = await import('sortablejs')
  if (sortables.has(el)) return
  sortables.set(el, SortableJS.create(el, {
    group: 'merrick-ingredients',
    handle: '[data-drag-handle]',
    draggable: '[data-ingredient]',
    animation: 150,
    ghostClass: 'opacity-40',
    // Glisser géré par Sortable lui-même (pointeur) plutôt que le drag & drop natif :
    // même comportement souris / tactile, et fiable entre deux plats
    forceFallback: true,
    fallbackOnBody: true,
    fallbackClass: 'shadow-lg',
    onEnd(evt) {
      const { from, to, item, oldDraggableIndex, newDraggableIndex } = evt
      if (oldDraggableIndex === undefined || newDraggableIndex === undefined) return
      const fromDish = dishes.value[Number(from.dataset.dish)]
      const toDish = dishes.value[Number(to.dataset.dish)]
      if (!fromDish || !toDish) return
      if (from === to && oldDraggableIndex === newDraggableIndex) return
      // Sortable a déplacé l'élément du DOM : on le remet en place et on laisse Vue
      // re-rendre à partir des données
      item.remove()
      from.insertBefore(item, from.querySelectorAll('[data-ingredient]')[oldDraggableIndex] ?? from.querySelector('[data-drop-hint]'))
      const [moved] = fromDish.ingredients.splice(oldDraggableIndex, 1)
      if (moved) toDish.ingredients.splice(newDraggableIndex, 0, moved)
    }
  }))
}

onBeforeUnmount(() => {
  for (const sortable of sortables.values()) sortable.destroy()
  sortables.clear()
})
</script>

<template>
  <div class="space-y-4">
    <UCard
      v-for="(dish, dishIndex) in dishes"
      :key="uid(dish)"
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

      <div
        :ref="bindSortable"
        :data-dish="dishIndex"
        class="space-y-2 min-h-10"
      >
        <div
          v-for="(ing, ingIndex) in dish.ingredients"
          :key="uid(ing)"
          data-ingredient
          class="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-md bg-default"
        >
          <span
            data-drag-handle
            class="cursor-grab active:cursor-grabbing touch-none p-1 text-muted hover:text-default"
            :title="$t('tools.fishing.merrick.dragHint')"
          >
            <UIcon
              name="i-lucide-grip-vertical"
              class="size-5 block"
            />
          </span>
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
        <!-- Zone de dépôt visible quand le plat est vide -->
        <p
          v-if="!dish.ingredients.length"
          data-drop-hint
          class="text-sm text-muted text-center border border-dashed border-default rounded-md py-2"
        >
          {{ $t('tools.fishing.merrick.dropHere') }}
        </p>
      </div>
      <UButton
        v-if="dish.ingredients.length < MERRICK_LIMITS.ingredientsPerDish"
        icon="i-lucide-plus"
        size="sm"
        variant="soft"
        class="mt-2"
        :label="$t('tools.fishing.merrick.addIngredient')"
        @click="dish.ingredients.push(newIngredient())"
      />
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
