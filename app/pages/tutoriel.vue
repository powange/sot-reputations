<script setup lang="ts">
import { generateBookmarkletCode, minifyBookmarkletCode, BOOKMARKLET_VERSION } from '~/utils/bookmarklet'

const { t } = useI18n()

useSeoMeta({
  title: () => t('tutorial.title'),
  description: () => t('tutorial.subtitle')
})

const config = useRuntimeConfig()
const siteUrl = config.public.siteUrl || 'https://reputations.sot.powange.com'

// Code du bookmarklet
const bookmarkletCode = computed(() => generateBookmarkletCode(siteUrl))
const bookmarkletUrl = computed(() => minifyBookmarkletCode(bookmarkletCode.value))

const toast = useToast()
const copied = ref(false)

async function copyBookmarklet() {
  try {
    await navigator.clipboard.writeText(bookmarkletUrl.value)
    copied.value = true
    toast.add({
      title: t('common.copied'),
      description: t('bookmarklet.dataCopied'),
      color: 'success'
    })
    setTimeout(() => copied.value = false, 3000)
  } catch {
    toast.add({
      title: t('common.error'),
      description: t('bookmarklet.errorFetching'),
      color: 'error'
    })
  }
}

const activeTab = ref('bookmarklet')

// Gérer l'ancre dans l'URL pour ouvrir la bonne tab
onMounted(() => {
  const hash = window.location.hash.slice(1)
  if (hash === 'bookmarklet' || hash === 'manual') {
    activeTab.value = hash
  }
})
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <UButton
        to="/"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        {{ $t('tutorial.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ $t('tutorial.subtitle') }}
      </p>
    </div>

    <!-- Avertissement -->
    <UAlert
      icon="i-lucide-shield-check"
      color="success"
      :title="$t('tutorial.privacyTitle')"
      class="mb-8"
    >
      <template #description>
        {{ $t('tutorial.privacyDescription') }}
      </template>
    </UAlert>

    <!-- Onglets -->
    <UTabs
      v-model="activeTab"
      :items="[
        { value: 'bookmarklet', label: $t('tutorial.tabs.bookmarklet'), slot: 'bookmarklet', icon: 'i-lucide-bookmark' },
        { value: 'manual', label: $t('tutorial.tabs.manual'), slot: 'manual', icon: 'i-lucide-code' }
      ]"
      class="mb-6"
    >
      <!-- Onglet Bookmarklet -->
      <template #bookmarklet>
        <div class="space-y-6 mt-6">
          <!-- Etape 1 -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 class="text-lg font-semibold">
                  {{ $t('tutorial.step1.title') }}
                  <span class="text-xs font-normal text-muted ml-2">v{{ BOOKMARKLET_VERSION }}</span>
                </h3>
              </div>
            </template>

            <p class="mb-4">
              {{ $t('tutorial.step1.description') }}
            </p>

            <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted/50 rounded-lg mb-4">
              <a
                :href="bookmarkletUrl"
                draggable="true"
                class="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium cursor-grab active:cursor-grabbing select-none"
                @click.prevent
              >
                <span>⚓</span>
                <span>SoT Reputations</span>
              </a>
              <span class="text-muted text-sm">
                ← {{ $t('tutorial.step1.dragHint') }}
              </span>
            </div>

            <UAlert
              icon="i-lucide-info"
              color="info"
              class="mb-4"
            >
              <template #title>{{ $t('tutorial.step1.dragNotWorking') }}</template>
              <template #description>
                <ol class="list-decimal list-inside space-y-1 mt-2 text-sm">
                  <li>{{ $t('tutorial.step1.instructions.1') }}</li>
                  <li>{{ $t('tutorial.step1.instructions.2') }}</li>
                  <li>{{ $t('tutorial.step1.instructions.3') }}</li>
                  <li>{{ $t('tutorial.step1.instructions.4') }}</li>
                </ol>
              </template>
            </UAlert>

            <UButton
              :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
              :label="copied ? $t('common.copied') : $t('tutorial.step1.copyCode')"
              variant="outline"
              size="sm"
              @click="copyBookmarklet"
            />
          </UCard>

          <!-- Etape 2 -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 class="text-lg font-semibold">
                  {{ $t('tutorial.step2.title') }}
                </h3>
              </div>
            </template>

            <p class="mb-4">
              {{ $t('tutorial.step2.description') }}
            </p>

            <UButton
              href="https://www.seaofthieves.com/profile/reputation"
              target="_blank"
              icon="i-lucide-external-link"
              :label="$t('tutorial.step2.openSoT')"
            />

            <UAlert
              icon="i-lucide-globe"
              color="warning"
              class="mt-4"
            >
              <template #title>
                {{ $t('tutorial.step2.languageWarning') }}
              </template>
              <template #description>
                {{ $t('tutorial.step2.languageWarningDescription') }}
              </template>
            </UAlert>
          </UCard>

          <!-- Etape 3 -->
          <UCard>
            <template #header>
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 class="text-lg font-semibold">
                  {{ $t('tutorial.step3.title') }}
                </h3>
              </div>
            </template>

            <p class="mb-4">
              {{ $t('tutorial.step3.description') }}
            </p>

            <div class="grid sm:grid-cols-2 gap-4">
              <div class="p-4 bg-muted/50 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                  <UIcon name="i-lucide-download" class="w-5 h-5 text-primary" />
                  <span class="font-medium">{{ $t('tutorial.step3.optionImport') }}</span>
                </div>
                <p class="text-sm text-muted">
                  {{ $t('tutorial.step3.optionImportDescription') }}
                </p>
              </div>

              <div class="p-4 bg-muted/50 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                  <UIcon name="i-lucide-clipboard" class="w-5 h-5 text-primary" />
                  <span class="font-medium">{{ $t('tutorial.step3.optionCopy') }}</span>
                </div>
                <p class="text-sm text-muted">
                  {{ $t('tutorial.step3.optionCopyDescription') }}
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </template>

      <!-- Onglet Methode manuelle -->
      <template #manual>
        <div class="space-y-6 mt-6">
          <UAlert
            icon="i-lucide-info"
            color="info"
          >
            <template #description>
              {{ $t('tutorial.manual.intro') }}
            </template>
          </UAlert>

          <UCard>
            <ol class="space-y-4">
              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">1</span>
                <div>
                  <p class="font-medium">
                    {{ $t('tutorial.manual.step1') }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ $t('tutorial.manual.step1Description') }}
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">2</span>
                <div>
                  <p class="font-medium">
                    {{ $t('tutorial.manual.step2') }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ $t('tutorial.manual.step2Description') }}
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">3</span>
                <div>
                  <p class="font-medium">
                    {{ $t('tutorial.manual.step3') }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ $t('tutorial.manual.step3Description') }}
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">4</span>
                <div>
                  <p class="font-medium">
                    {{ $t('tutorial.manual.step4') }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ $t('tutorial.manual.step4Description') }}
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">5</span>
                <div>
                  <p class="font-medium">
                    {{ $t('tutorial.manual.step5') }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ $t('tutorial.manual.step5Description') }}
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">6</span>
                <div>
                  <p class="font-medium">
                    {{ $t('tutorial.manual.step6') }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ $t('tutorial.manual.step6Description') }}
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">7</span>
                <div>
                  <p class="font-medium">
                    {{ $t('tutorial.manual.step7') }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ $t('tutorial.manual.step7Description') }}
                  </p>
                </div>
              </li>

              <li class="flex gap-3">
                <span class="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-medium">8</span>
                <div>
                  <p class="font-medium">
                    {{ $t('tutorial.manual.step8') }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ $t('tutorial.manual.step8Description') }}
                  </p>
                </div>
              </li>
            </ol>
          </UCard>

          <!-- Exemple de JSON -->
          <UCard>
            <template #header>
              <h3 class="font-semibold">
                {{ $t('tutorial.manual.jsonExample') }}
              </h3>
            </template>

            <pre class="text-xs bg-muted/50 p-3 rounded-lg overflow-x-auto">{
  "AthenasFortune": {
    "Motto": "Les mers nous appartiennent",
    "Level": 501,
    "Emblems": { ... }
  },
  "GoldHoarders": { ... },
  ...
}</pre>
          </UCard>
        </div>
      </template>
    </UTabs>
  </UContainer>
</template>
