<script setup lang="ts">
const { t } = useI18n()

useSeoMeta({
  title: () => `${t('tools.fishing.title')} - SoT Reputations`,
  description: () => t('tools.fishing.description')
})

const sections = ['basics', 'bait', 'species', 'cooking', 'commendations', 'junk', 'tips'] as const

// --- Filtres de la liste des espèces ---
const baitFilter = ref<FishBait | null>(null)
const search = ref('')

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const filteredSpecies = computed(() => {
  const q = normalize(search.value.trim())
  return FISH_SPECIES.filter((species) => {
    if (baitFilter.value && species.bait !== baitFilter.value) return false
    if (!q) return true
    const haystack = [
      t(`tools.fishing.species.${species.key}.name`),
      t(`tools.fishing.species.${species.key}.location`),
      ...species.variants.flatMap(v => [t(`tools.fishing.variants.${species.key}.${v.key}`), ...(v.islands ?? [])])
    ]
    return haystack.some(s => normalize(s).includes(q))
  })
})
</script>

<template>
  <UContainer class="py-8 max-w-5xl">
    <div class="mb-6">
      <UButton
        to="/tools"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('tools.title')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        {{ $t('tools.fishing.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ $t('tools.fishing.description') }}
      </p>
    </div>

    <!-- Sommaire -->
    <nav class="flex flex-wrap gap-2 mb-8">
      <UButton
        v-for="s in sections"
        :key="s"
        :to="`#${s}`"
        size="sm"
        variant="soft"
        color="neutral"
        :label="$t(`tools.fishing.toc.${s}`)"
      />
    </nav>

    <!-- Sous-outils -->
    <NuxtLink
      to="/tools/fishing/merrick"
      class="block mb-8"
    >
      <UCard class="transition hover:ring-primary hover:ring-2">
        <div class="flex items-center gap-3">
          <UIcon
            name="i-lucide-chef-hat"
            class="size-8 text-primary shrink-0"
          />
          <div class="flex-1">
            <h2 class="font-semibold text-lg">
              {{ $t('tools.fishing.merrick.guideCta') }}
            </h2>
            <p class="text-sm text-muted">
              {{ $t('tools.fishing.merrick.description') }}
            </p>
          </div>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-5 text-muted"
          />
        </div>
      </UCard>
    </NuxtLink>

    <div class="space-y-10">
      <!-- Les bases -->
      <section
        id="basics"
        class="scroll-mt-20"
      >
        <h2 class="text-2xl font-pirate mb-4">
          {{ $t('tools.fishing.toc.basics') }}
        </h2>
        <UCard>
          <ol class="list-decimal pl-5 space-y-2">
            <li>{{ $t('tools.fishing.basics.equip') }}</li>
            <li>{{ $t('tools.fishing.basics.cast') }}</li>
            <li>{{ $t('tools.fishing.basics.tension') }}</li>
            <li>{{ $t('tools.fishing.basics.reel') }}</li>
          </ol>
          <p class="text-sm text-muted mt-4">
            {{ $t('tools.fishing.basics.cancel') }}
          </p>
        </UCard>
        <UAlert
          icon="i-lucide-lightbulb"
          color="info"
          variant="subtle"
          :title="$t('tools.fishing.basics.tiredTitle')"
          :description="$t('tools.fishing.basics.tired')"
          class="mt-4"
        />
      </section>

      <!-- Appâts -->
      <section
        id="bait"
        class="scroll-mt-20"
      >
        <h2 class="text-2xl font-pirate mb-4">
          {{ $t('tools.fishing.toc.bait') }}
        </h2>
        <p class="text-muted mb-4">
          {{ $t('tools.fishing.bait.intro') }}
        </p>
        <div class="grid gap-4 sm:grid-cols-3 mb-4">
          <UCard
            v-for="b in (['earthworms', 'grubs', 'leeches'] as const)"
            :key="b"
          >
            <div class="flex items-center gap-2 font-semibold mb-2">
              <UIcon
                :name="FISH_BAIT_ICONS[b]"
                class="size-5 text-primary"
              />
              {{ $t(`tools.fishing.bait.${b}`) }}
            </div>
            <p class="text-sm">
              {{ $t(`tools.fishing.bait.where${b[0]!.toUpperCase()}${b.slice(1)}`) }}
            </p>
          </UCard>
        </div>
        <p class="text-sm text-muted mb-4">
          {{ $t('tools.fishing.bait.barrels') }}
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <UCard>
            <h3 class="font-semibold mb-2">
              {{ $t('tools.fishing.bait.buyTitle') }}
            </h3>
            <ul class="list-disc pl-5 space-y-1 text-sm">
              <li>{{ $t('tools.fishing.bait.buyShipwright') }}</li>
              <li>{{ $t('tools.fishing.bait.buyCrate') }}</li>
            </ul>
          </UCard>
          <UCard>
            <h3 class="font-semibold mb-2">
              {{ $t('tools.fishing.bait.storageTitle') }}
            </h3>
            <p class="text-sm">
              {{ $t('tools.fishing.bait.storage') }}
            </p>
            <p class="text-sm text-muted mt-2">
              {{ $t('tools.fishing.bait.raw') }}
            </p>
          </UCard>
        </div>
      </section>

      <!-- Espèces -->
      <section
        id="species"
        class="scroll-mt-20"
      >
        <h2 class="text-2xl font-pirate mb-4">
          {{ $t('tools.fishing.toc.species') }}
        </h2>
        <p class="text-muted mb-4">
          {{ $t('tools.fishing.species.intro') }}
        </p>

        <div class="flex flex-col sm:flex-row gap-3 mb-4">
          <UInput
            v-model="search"
            icon="i-lucide-search"
            :placeholder="$t('tools.fishing.species.search')"
            class="sm:w-72"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              size="sm"
              :variant="baitFilter === null ? 'solid' : 'soft'"
              :label="$t('tools.fishing.species.all')"
              @click="baitFilter = null"
            />
            <UButton
              v-for="b in FISH_BAITS"
              :key="b"
              size="sm"
              :icon="FISH_BAIT_ICONS[b]"
              :variant="baitFilter === b ? 'solid' : 'soft'"
              :label="$t(`tools.fishing.bait.${b}`)"
              @click="baitFilter = baitFilter === b ? null : b"
            />
          </div>
        </div>

        <div
          v-if="filteredSpecies.length"
          class="grid gap-4 md:grid-cols-2"
        >
          <UCard
            v-for="species in filteredSpecies"
            :key="species.key"
          >
            <template #header>
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h3 class="font-semibold text-lg">
                    {{ $t(`tools.fishing.species.${species.key}.name`) }}
                  </h3>
                  <p class="text-sm text-muted flex items-center gap-1">
                    <UIcon
                      name="i-lucide-map-pin"
                      class="size-4 shrink-0"
                    />
                    {{ $t(`tools.fishing.species.${species.key}.location`) }}
                  </p>
                </div>
                <UBadge
                  :icon="FISH_BAIT_ICONS[species.bait]"
                  :color="species.bait === 'none' ? 'neutral' : 'primary'"
                  variant="subtle"
                  :label="$t(`tools.fishing.bait.${species.bait}`)"
                  class="shrink-0"
                />
              </div>
            </template>

            <ul class="space-y-2">
              <li
                v-for="variant in species.variants"
                :key="variant.key"
              >
                <div class="flex items-center gap-2">
                  <UBadge
                    :color="FISH_KIND_COLORS[variant.kind]"
                    variant="soft"
                    size="sm"
                    class="w-16 justify-center"
                    :label="$t(`tools.fishing.species.kind.${variant.kind}`)"
                  />
                  <span>{{ $t(`tools.fishing.variants.${species.key}.${variant.key}`) }}</span>
                  <span
                    v-if="variant.note"
                    class="text-xs text-muted"
                  >
                    — {{ $t(`tools.fishing.variantNotes.${variant.note}`) }}
                  </span>
                </div>
                <p
                  v-if="variant.islands"
                  class="text-xs text-muted ml-18 mt-0.5"
                >
                  {{ variant.islands.join(', ') }}
                </p>
              </li>
            </ul>
          </UCard>
        </div>
        <p
          v-else
          class="text-muted text-center py-8"
        >
          {{ $t('tools.fishing.species.noResult') }}
        </p>
      </section>

      <!-- Cuisson -->
      <section
        id="cooking"
        class="scroll-mt-20"
      >
        <h2 class="text-2xl font-pirate mb-4">
          {{ $t('tools.fishing.toc.cooking') }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 mb-4">
          <UCard>
            <div class="flex items-center gap-3">
              <UIcon
                name="i-lucide-flame"
                class="size-8 text-primary"
              />
              <div>
                <p class="text-sm text-muted">
                  {{ $t('tools.fishing.cooking.normal') }}
                </p>
                <p class="text-xl font-semibold">
                  {{ $t('tools.fishing.cooking.normalTime') }}
                </p>
              </div>
            </div>
          </UCard>
          <UCard>
            <div class="flex items-center gap-3">
              <UIcon
                name="i-lucide-trophy"
                class="size-8 text-primary"
              />
              <div>
                <p class="text-sm text-muted">
                  {{ $t('tools.fishing.cooking.trophy') }}
                </p>
                <p class="text-xl font-semibold">
                  {{ $t('tools.fishing.cooking.trophyTime') }}
                </p>
              </div>
            </div>
          </UCard>
        </div>
        <p class="text-sm mb-2">
          {{ $t('tools.fishing.cooking.heal') }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('tools.fishing.cooking.found') }}
        </p>
      </section>

      <!-- Promotions -->
      <section
        id="commendations"
        class="scroll-mt-20"
      >
        <h2 class="text-2xl font-pirate mb-4">
          {{ $t('tools.fishing.toc.commendations') }}
        </h2>
        <UCard>
          <p class="mb-3">
            {{ $t('tools.fishing.commendations.perVariant') }}
          </p>
          <ul class="list-disc pl-5 space-y-1 text-sm">
            <li>{{ $t('tools.fishing.commendations.trophy25') }}</li>
            <li>{{ $t('tools.fishing.commendations.trophy50') }}</li>
            <li>{{ $t('tools.fishing.commendations.trophy100') }}</li>
            <li>{{ $t('tools.fishing.commendations.legendary') }}</li>
            <li>{{ $t('tools.fishing.commendations.athena') }}</li>
          </ul>
        </UCard>
        <UAlert
          icon="i-lucide-coins"
          color="primary"
          variant="subtle"
          :title="$t('tools.fishing.commendations.sellTitle')"
          :description="$t('tools.fishing.commendations.sell')"
          class="mt-4"
        />
      </section>

      <!-- Butins sournois -->
      <section
        id="junk"
        class="scroll-mt-20"
      >
        <h2 class="text-2xl font-pirate mb-4">
          {{ $t('tools.fishing.toc.junk') }}
        </h2>
        <UCard>
          <p>{{ $t('tools.fishing.junk.intro') }}</p>
          <p class="text-sm text-muted mt-2">
            {{ $t('tools.fishing.junk.value') }}
          </p>
          <p class="text-sm mt-2">
            {{ $t('tools.fishing.junk.spots') }}
          </p>
        </UCard>
      </section>

      <!-- Astuces -->
      <section
        id="tips"
        class="scroll-mt-20"
      >
        <h2 class="text-2xl font-pirate mb-4">
          {{ $t('tools.fishing.toc.tips') }}
        </h2>
        <UCard>
          <ul class="list-disc pl-5 space-y-2">
            <li>{{ $t('tools.fishing.tips.trophy') }}</li>
            <li>{{ $t('tools.fishing.tips.skeletons') }}</li>
            <li>{{ $t('tools.fishing.tips.shadowStorm') }}</li>
            <li>{{ $t('tools.fishing.tips.storm') }}</li>
            <li>{{ $t('tools.fishing.tips.volcano') }}</li>
          </ul>
        </UCard>
      </section>

      <p class="text-xs text-muted text-center">
        {{ $t('tools.fishing.sourcePrefix') }}
        <ULink
          to="https://sotfr.net/guides/gameplay/guide-peche-chasse/"
          target="_blank"
          class="underline"
        >
          {{ $t('tools.fishing.sourceLink') }}
        </ULink>.
      </p>
    </div>
  </UContainer>
</template>
