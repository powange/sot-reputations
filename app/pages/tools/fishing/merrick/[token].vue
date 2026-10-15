<script setup lang="ts">
const { t } = useI18n()
const toast = useToast()
const route = useRoute()
const token = route.params.token as string
const { itemLabel } = useMerrickLabels()
const cooking = useCookingTimers()
const { remember, forget } = useMerrickRecent()

const { data: quest, error, refresh } = await useFetch<MerrickQuest>(`/api/merrick-quests/${token}`, {
  key: `merrick-${token}`,
  // Les coches modifient les ingrédients en place (optimiste + temps réel)
  deep: true
})

useSeoMeta({
  title: () => `${t('tools.fishing.merrick.title')} - SoT Reputations`,
  robots: 'noindex'
})

const shareUrl = computed(() => `${useRequestURL().origin}/tools/fishing/merrick/${token}`)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    toast.add({ title: t('tools.fishing.merrick.copied'), color: 'success' })
  } catch {
    // Presse-papiers indisponible : le lien reste sélectionnable dans le champ
  }
}

const ingredients = computed(() => quest.value?.dishes.flatMap(d => d.ingredients) ?? [])
const total = computed(() => ingredients.value.reduce((n, i) => n + i.quantity, 0))
const done = computed(() => ingredients.value.reduce((n, i) => n + Math.min(i.delivered ?? 0, i.quantity), 0))

// Rareté, lieu et appât de chaque poisson (par id d'ingrédient)
const fishInfo = computed(() => {
  const map = new Map<number, { kind: FishVariantKind | null, place: string, bait: FishBait }>()
  for (const ing of ingredients.value) {
    const details = merrickFishDetails(ing)
    if (!details || ing.id === undefined) continue
    const v = details.variant
    let place = v?.islands?.join(', ') ?? t(`tools.fishing.species.${ing.key}.location`)
    if (v?.note) place += ` — ${t(`tools.fishing.variantNotes.${v.note}`)}`
    map.set(ing.id, { kind: v?.kind ?? null, place, bait: details.species.bait })
  }
  return map
})

// Récapitulatif de ce qu'il reste, tous plats confondus (même item + même état cumulés)
const remaining = computed(() => {
  const map = new Map<string, { ing: MerrickIngredient, count: number }>()
  for (const ing of ingredients.value) {
    const left = ing.quantity - (ing.delivered ?? 0)
    if (left <= 0) continue
    const k = `${merrickItemId(ing)}|${ing.state}`
    const entry = map.get(k)
    if (entry) entry.count += left
    else map.set(k, { ing, count: left })
  }
  return [...map.values()]
})

// --- Minuteurs de cuisson partagés : l'heure de mise sur le feu est stockée sur le
// serveur et diffusée, chaque membre voit donc la même cuisson progresser ---
// Écart entre l'horloge du serveur et celle de cet appareil (ms)
let clockOffset = 0
function syncClock(serverTime: number | undefined) {
  if (serverTime) clockOffset = serverTime - Date.now()
}

function timerKey(ing: MerrickIngredient) {
  return `merrick:${token}:${ing.id}`
}

type ItemState = Pick<MerrickIngredient, 'delivered' | 'trophy' | 'cookingStartedAt'> & { id: number, serverTime?: number }

function applyItemState(state: ItemState) {
  syncClock(state.serverTime)
  const ing = ingredients.value.find(i => i.id === state.id)
  if (ing) Object.assign(ing, { delivered: state.delivered, trophy: state.trophy, cookingStartedAt: state.cookingStartedAt })
}

async function patchItem(ing: MerrickIngredient, body: { trophy?: boolean, cooking?: 'start' | 'stop' }) {
  cooking.unlockAudio()
  try {
    applyItemState(await $fetch<ItemState>(`/api/merrick-quests/${token}/items/${ing.id}`, { method: 'PATCH', body }))
  } catch {
    toast.add({ title: t('tools.fishing.merrick.errorSave'), color: 'error' })
  }
}

// Reflète l'état serveur dans les minuteurs locaux (barre, bips, notifications).
// Côté client uniquement : appelé au montage puis à chaque changement.
function syncTimers() {
  const active = new Set<string>()
  for (const ing of ingredients.value) {
    const food = cookingFoodFor(ing)
    if (!food || !ing.cookingStartedAt || (ing.delivered ?? 0) >= ing.quantity) continue
    const key = timerKey(ing)
    active.add(key)
    cooking.syncShared(key, food, ing.cookingStartedAt - clockOffset, { label: itemLabel(ing), image: merrickItemImage(ing) })
  }
  cooking.removeByKey(key => key.startsWith(`merrick:${token}:`) && !active.has(key))
}
watch(() => ingredients.value.map(i => [i.id, i.cookingStartedAt, i.trophy, i.delivered]), syncTimers, { deep: true })

// --- Temps réel ---
const live = ref(false)
let eventSource: EventSource | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let closed = false

function connect() {
  if (closed) return
  eventSource = new EventSource(`/api/merrick-quests/${token}/events`)
  eventSource.addEventListener('connected', () => {
    live.value = true
  })
  eventSource.addEventListener('item', (event) => {
    applyItemState(JSON.parse(event.data))
  })
  eventSource.addEventListener('quest', (event) => {
    if (editing.value) return
    const next = JSON.parse(event.data) as MerrickQuest
    syncClock(next.serverTime)
    quest.value = next
  })
  eventSource.addEventListener('deleted', () => {
    closed = true
    eventSource?.close()
    forget(token)
    toast.add({ title: t('tools.fishing.merrick.deletedByOther'), color: 'info' })
    navigateTo('/tools/fishing/merrick')
  })
  eventSource.addEventListener('error', () => {
    live.value = false
    eventSource?.close()
    if (closed) return
    if (reconnectTimer) clearTimeout(reconnectTimer)
    // À la reconnexion on recharge la liste pour rattraper les coches manquées
    reconnectTimer = setTimeout(async () => {
      await refresh()
      connect()
    }, 5000)
  })
}

// Les bips d'un minuteur lancé par un autre membre ne peuvent sonner qu'une fois le son
// débloqué par un geste sur la page : le premier clic/toucher suffit
function unlockOnGesture() {
  cooking.unlockAudio()
}

onMounted(() => {
  window.addEventListener('pointerdown', unlockOnGesture, { once: true })
  if (!quest.value) return
  syncClock(quest.value.serverTime)
  syncTimers()
  const names = quest.value.dishes.map(d => d.name).filter(Boolean)
  remember(token, names.length ? names.join(' · ') : t('tools.fishing.merrick.title'))
  connect()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', unlockOnGesture)
  // Les minuteurs partagés n'existent que sur la page de la liste
  cooking.removeByKey(key => key.startsWith(`merrick:${token}:`))
  closed = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  eventSource?.close()
})

// --- Suppression (seulement une fois tout livré) ---
const deleting = ref(false)

async function deleteQuest() {
  if (!confirm(t('tools.fishing.merrick.deleteConfirm'))) return
  deleting.value = true
  // Notre propre événement 'deleted' ne doit pas déclencher une seconde redirection
  closed = true
  eventSource?.close()
  try {
    await $fetch(`/api/merrick-quests/${token}`, { method: 'DELETE' })
    forget(token)
    toast.add({ title: t('tools.fishing.merrick.deleted'), color: 'success' })
    await navigateTo('/tools/fishing/merrick')
  } catch {
    toast.add({ title: t('tools.fishing.merrick.errorSave'), color: 'error' })
    closed = false
    connect()
  } finally {
    deleting.value = false
  }
}

// --- Modification de la liste ---
const editing = ref(false)
const draft = ref<MerrickDish[]>([])
const saving = ref(false)

function startEdit() {
  draft.value = structuredClone(toRaw(quest.value!.dishes))
  editing.value = true
}

async function saveEdit() {
  if (!draft.value.length || draft.value.some(d => !d.ingredients.length)) {
    toast.add({ title: t('tools.fishing.merrick.invalid'), color: 'warning' })
    return
  }
  saving.value = true
  try {
    quest.value = await $fetch<MerrickQuest>(`/api/merrick-quests/${token}`, {
      method: 'PUT',
      body: { dishes: draft.value }
    })
    editing.value = false
  } catch {
    toast.add({ title: t('tools.fishing.merrick.errorSave'), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <UButton
      to="/tools/fishing/merrick"
      variant="ghost"
      icon="i-lucide-arrow-left"
      :label="$t('tools.fishing.merrick.title')"
      class="mb-4"
    />

    <UAlert
      v-if="error || !quest"
      icon="i-lucide-circle-alert"
      color="warning"
      :title="$t('tools.fishing.merrick.notFound')"
    >
      <template #actions>
        <UButton
          to="/tools/fishing/merrick"
          :label="$t('tools.fishing.merrick.newList')"
        />
      </template>
    </UAlert>

    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 class="text-4xl font-pirate">
          {{ $t('tools.fishing.merrick.title') }}
        </h1>
        <UBadge
          :color="live ? 'success' : 'neutral'"
          variant="subtle"
          :icon="live ? 'i-lucide-radio' : 'i-lucide-loader'"
          :label="live ? $t('tools.fishing.merrick.live') : $t('tools.fishing.merrick.reconnecting')"
        />
      </div>

      <!-- Partage -->
      <UCard class="mb-6">
        <h2 class="font-semibold mb-1">
          {{ $t('tools.fishing.merrick.shareTitle') }}
        </h2>
        <p class="text-sm text-muted mb-3">
          {{ $t('tools.fishing.merrick.shareHint') }}
        </p>
        <div class="flex gap-2">
          <UInput
            :model-value="shareUrl"
            readonly
            class="flex-1"
            @focus="($event.target as HTMLInputElement).select()"
          />
          <UButton
            icon="i-lucide-copy"
            :label="$t('tools.fishing.merrick.copy')"
            @click="copyLink"
          />
        </div>
      </UCard>

      <!-- Modification -->
      <template v-if="editing">
        <MerrickQuestEditor v-model="draft" />
        <div class="flex gap-2 mt-6">
          <UButton
            icon="i-lucide-save"
            :label="$t('tools.fishing.merrick.save')"
            :loading="saving"
            @click="saveEdit"
          />
          <UButton
            variant="ghost"
            color="neutral"
            :label="$t('tools.fishing.merrick.cancel')"
            @click="editing = false"
          />
        </div>
      </template>

      <template v-else>
        <!-- Avancement -->
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <span class="font-semibold">{{ $t('tools.fishing.merrick.progress', { done, total }) }}</span>
            <UButton
              icon="i-lucide-pencil"
              size="sm"
              variant="soft"
              :label="$t('tools.fishing.merrick.edit')"
              @click="startEdit"
            />
          </div>
          <UProgress
            :model-value="done"
            :max="total"
            :color="done === total ? 'success' : 'primary'"
          />
        </div>

        <UAlert
          v-if="total > 0 && done === total"
          icon="i-lucide-party-popper"
          color="success"
          :title="$t('tools.fishing.merrick.allDone')"
          class="mb-6"
        >
          <template #actions>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="solid"
              :label="$t('tools.fishing.merrick.delete')"
              :loading="deleting"
              @click="deleteQuest"
            />
          </template>
        </UAlert>
        <UCard
          v-else
          class="mb-6"
        >
          <h2 class="font-semibold mb-2">
            {{ $t('tools.fishing.merrick.remaining') }}
          </h2>
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-for="r in remaining"
              :key="`${merrickItemId(r.ing)}|${r.ing.state}`"
              variant="soft"
              color="neutral"
              size="lg"
            >
              <img
                :src="merrickItemImage(r.ing)"
                alt=""
                width="24"
                height="24"
                class="size-6"
              >
              {{ r.count }} × {{ itemLabel(r.ing) }}
              <span class="text-muted">({{ $t(`tools.fishing.merrick.state.${r.ing.state}`).toLowerCase() }})</span>
            </UBadge>
          </div>
        </UCard>

        <!-- Plats -->
        <div class="space-y-4">
          <UCard
            v-for="(dish, dishIndex) in quest.dishes"
            :key="dishIndex"
          >
            <template #header>
              <p class="text-xs uppercase tracking-wide text-muted">
                {{ $t(`tools.fishing.merrick.course.${dish.course}`) }}
              </p>
              <h2
                v-if="dish.name"
                class="text-lg font-semibold"
              >
                {{ dish.name }}
              </h2>
            </template>

            <ul class="divide-y divide-default">
              <li
                v-for="ing in dish.ingredients"
                :key="ing.id"
                class="flex items-center gap-3 py-2"
              >
                <UButton
                  v-if="ing.quantity === 1"
                  :icon="ing.delivered ? 'i-lucide-circle-check' : 'i-lucide-circle'"
                  :color="ing.delivered ? 'success' : 'neutral'"
                  variant="ghost"
                  size="xl"
                  :aria-pressed="!!ing.delivered"
                  :aria-label="itemLabel(ing)"
                  @click="step(ing, ing.delivered ? -1 : 1)"
                />
                <div
                  v-else
                  class="flex items-center gap-1"
                >
                  <UButton
                    icon="i-lucide-minus"
                    size="sm"
                    color="neutral"
                    variant="soft"
                    :disabled="!ing.delivered"
                    @click="step(ing, -1)"
                  />
                  <span
                    class="w-12 text-center font-semibold tabular-nums"
                    :class="{ 'text-success': ing.delivered === ing.quantity }"
                  >
                    {{ ing.delivered ?? 0 }}/{{ ing.quantity }}
                  </span>
                  <UButton
                    icon="i-lucide-plus"
                    size="sm"
                    color="neutral"
                    variant="soft"
                    :disabled="ing.delivered === ing.quantity"
                    @click="step(ing, 1)"
                  />
                </div>
                <img
                  :src="merrickItemImage(ing)"
                  alt=""
                  width="48"
                  height="48"
                  loading="lazy"
                  class="size-12 shrink-0"
                  :class="{ 'opacity-40 grayscale': ing.delivered === ing.quantity }"
                >
                <div class="flex-1 min-w-0">
                  <span :class="{ 'line-through text-muted': ing.delivered === ing.quantity }">
                    <template v-if="ing.quantity > 1">{{ ing.quantity }} × </template>{{ itemLabel(ing) }}
                  </span>
                  <!-- Où pêcher : rareté de la variété, zone, appât -->
                  <div
                    v-if="fishInfo.get(ing.id!) && ing.delivered !== ing.quantity"
                    class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted"
                  >
                    <UBadge
                      v-if="fishInfo.get(ing.id!)!.kind"
                      :color="FISH_KIND_COLORS[fishInfo.get(ing.id!)!.kind!]"
                      variant="soft"
                      size="sm"
                      :label="$t(`tools.fishing.species.kind.${fishInfo.get(ing.id!)!.kind}`)"
                    />
                    <span class="flex items-center gap-1">
                      <UIcon
                        name="i-lucide-map-pin"
                        class="size-3.5 shrink-0"
                      />
                      {{ fishInfo.get(ing.id!)!.place }}
                    </span>
                    <UBadge
                      :icon="FISH_BAIT_ICONS[fishInfo.get(ing.id!)!.bait]"
                      color="neutral"
                      variant="subtle"
                      size="sm"
                      :class="FISH_BAIT_CLASSES[fishInfo.get(ing.id!)!.bait].soft"
                      :label="$t(`tools.fishing.bait.${fishInfo.get(ing.id!)!.bait}`)"
                    />
                  </div>
                  <!-- Minuteur de cuisson en cours pour cet ingrédient -->
                  <div
                    v-if="cooking.timerFor(timerKey(ing))"
                    class="flex items-center gap-1 mt-2 max-w-sm"
                  >
                    <CookingTimerBar
                      :timer="cooking.timerFor(timerKey(ing))!"
                      class="flex-1"
                    />
                    <UButton
                      icon="i-lucide-rotate-ccw"
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :aria-label="$t('tools.fishing.cooking.timers.restart')"
                      @click="patchItem(ing, { cooking: 'start' })"
                    />
                    <UButton
                      icon="i-lucide-x"
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      :aria-label="$t('tools.fishing.cooking.timers.remove')"
                      @click="patchItem(ing, { cooking: 'stop' })"
                    />
                  </div>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                  <UBadge
                    :icon="ing.state === 'cooked' ? 'i-lucide-flame' : 'i-lucide-snowflake'"
                    :color="ing.state === 'cooked' ? 'warning' : 'info'"
                    variant="subtle"
                    :label="$t(`tools.fishing.merrick.state.${ing.state}`)"
                  />
                  <!-- Poisson récupéré en taille trophée : cuisson plus longue (partagé) -->
                  <UButton
                    v-if="ing.type === 'fish' && ing.delivered !== ing.quantity"
                    icon="i-lucide-trophy"
                    size="xs"
                    :color="ing.trophy ? 'warning' : 'neutral'"
                    :variant="ing.trophy ? 'solid' : 'outline'"
                    :label="$t('tools.fishing.merrick.trophy')"
                    :title="$t('tools.fishing.merrick.trophyHint')"
                    :aria-pressed="!!ing.trophy"
                    @click="patchItem(ing, { trophy: !ing.trophy })"
                  />
                  <UButton
                    v-if="cookingFoodFor(ing) && ing.delivered !== ing.quantity && !ing.cookingStartedAt"
                    icon="i-lucide-timer"
                    size="xs"
                    variant="soft"
                    :label="$t('tools.fishing.merrick.cookTimer', { seconds: COOKING_TIMES[cookingFoodFor(ing)!].cooked })"
                    :title="$t('tools.fishing.merrick.cookTimerHint')"
                    @click="patchItem(ing, { cooking: 'start' })"
                  />
                </div>
              </li>
            </ul>
          </UCard>
        </div>
      </template>

      <p class="text-xs text-muted mt-6">
        {{ $t('tools.fishing.merrick.expiry') }}
      </p>
    </template>
  </UContainer>
</template>
