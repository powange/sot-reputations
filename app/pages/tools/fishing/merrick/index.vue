<script setup lang="ts">
const { t, locale } = useI18n()
const toast = useToast()
const { recent } = useMerrickRecent()

useSeoMeta({
  title: () => `${t('tools.fishing.merrick.title')} - SoT Reputations`,
  description: () => t('tools.fishing.merrick.description')
})

// Un menu de Merrick compte toujours 3 plats : on part de 3 plats vides à remplir
const dishes = ref<MerrickDish[]>(MERRICK_COURSES.map(course => ({
  course,
  name: '',
  ingredients: [{ type: 'fish', key: 'splashtail', variant: null, state: 'cooked', quantity: 1 }]
})))

// --- Import OCR ---
const ocrLanguages: Array<{ label: string, value: MerrickOcrLanguage }> = [
  { label: 'Français', value: 'fra' },
  { label: 'English', value: 'eng' },
  { label: 'Español', value: 'spa' }
]
const ocrLang = ref<MerrickOcrLanguage>(locale.value === 'en' ? 'eng' : locale.value === 'es' ? 'spa' : 'fra')
const ocrRunning = ref(false)
const ocrProgress = ref<number | null>(null)
const ocrPass = ref({ pass: 1, total: 1 })
const fileInput = ref<HTMLInputElement | null>(null)
const cameraInput = ref<HTMLInputElement | null>(null)

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) runOcr(file)
}

// Capture d'écran dans le presse-papier : Ctrl+V n'importe où sur la page…
function onPaste(event: ClipboardEvent) {
  const file = [...(event.clipboardData?.files ?? [])].find(f => f.type.startsWith('image/'))
  if (!file) return
  event.preventDefault()
  runOcr(file)
}
onMounted(() => window.addEventListener('paste', onPaste))
onBeforeUnmount(() => window.removeEventListener('paste', onPaste))

// … ou bouton (API Clipboard : peut demander une autorisation, absente de certains navigateurs)
async function pasteFromClipboard() {
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find(t => t.startsWith('image/'))
      if (type) {
        const blob = await item.getType(type)
        runOcr(new File([blob], 'clipboard', { type }))
        return
      }
    }
    toast.add({ title: t('tools.fishing.merrick.clipboardEmpty'), color: 'warning' })
  } catch {
    toast.add({ title: t('tools.fishing.merrick.clipboardDenied'), color: 'warning' })
  }
}

async function runOcr(file: File) {
  if (ocrRunning.value) return
  ocrRunning.value = true
  ocrProgress.value = null
  try {
    const result = await recognizeMerrickMenu(file, ocrLang.value, (p) => {
      ocrProgress.value = p
    }, (pass, total) => {
      ocrPass.value = { pass, total }
    })
    const count = result.reduce((n, d) => n + d.ingredients.length, 0)
    if (count === 0) {
      toast.add({ title: t('tools.fishing.merrick.ocrNothing'), color: 'warning' })
    } else {
      dishes.value = result
      toast.add(isCompleteMenu(result)
        ? { title: t('tools.fishing.merrick.ocrDone', { count }), color: 'success' }
        : { title: t('tools.fishing.merrick.ocrPartial', { count }), color: 'warning' })
    }
  } catch (err) {
    console.error(err)
    toast.add({ title: t('tools.fishing.merrick.ocrError'), color: 'error' })
  } finally {
    ocrRunning.value = false
  }
}

// --- Création ---
const creating = ref(false)
const isValid = computed(() => dishes.value.length > 0 && dishes.value.every(d => d.ingredients.length > 0))

async function create() {
  if (!isValid.value) {
    toast.add({ title: t('tools.fishing.merrick.invalid'), color: 'warning' })
    return
  }
  creating.value = true
  try {
    const { token } = await $fetch<{ token: string }>('/api/merrick-quests', {
      method: 'POST',
      body: { dishes: dishes.value }
    })
    await navigateTo(`/tools/fishing/merrick/${token}`)
  } catch {
    toast.add({ title: t('tools.fishing.merrick.errorSave'), color: 'error' })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-6">
      <UButton
        to="/tools/fishing"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('tools.fishing.title')"
        class="mb-4"
      />
      <h1 class="text-4xl font-pirate">
        {{ $t('tools.fishing.merrick.title') }}
      </h1>
      <p class="text-muted mt-2">
        {{ $t('tools.fishing.merrick.intro') }}
      </p>
    </div>

    <UCard
      v-if="recent.length"
      class="mb-6"
    >
      <h2 class="font-semibold mb-2">
        {{ $t('tools.fishing.merrick.recent') }}
      </h2>
      <ul class="space-y-1">
        <li
          v-for="r in recent"
          :key="r.token"
        >
          <ULink
            :to="`/tools/fishing/merrick/${r.token}`"
            class="text-primary hover:underline"
          >
            {{ r.label }}
          </ULink>
          <span class="text-xs text-muted ml-2">{{ new Date(r.at).toLocaleDateString(locale) }}</span>
        </li>
      </ul>
    </UCard>

    <!-- Import depuis une capture -->
    <UCard class="mb-6">
      <h2 class="font-semibold flex items-center gap-2">
        <UIcon
          name="i-lucide-scan-text"
          class="size-5 text-primary"
        />
        {{ $t('tools.fishing.merrick.ocrTitle') }}
      </h2>
      <p class="text-sm text-muted mt-1 mb-4">
        {{ $t('tools.fishing.merrick.ocrHint') }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <USelect
          v-model="ocrLang"
          :items="ocrLanguages"
          :aria-label="$t('tools.fishing.merrick.ocrLanguage')"
          icon="i-lucide-languages"
          class="w-40"
          :disabled="ocrRunning"
        />
        <UButton
          icon="i-lucide-image-up"
          :label="$t('tools.fishing.merrick.ocrButton')"
          :loading="ocrRunning"
          @click="fileInput?.click()"
        />
        <!-- Sur mobile : photo de l'écran directement avec l'appareil photo arrière -->
        <UButton
          icon="i-lucide-camera"
          :label="$t('tools.fishing.merrick.takePhoto')"
          :disabled="ocrRunning"
          class="hidden pointer-coarse:inline-flex"
          @click="cameraInput?.click()"
        />
        <UButton
          icon="i-lucide-clipboard-paste"
          variant="soft"
          :label="$t('tools.fishing.merrick.paste')"
          :disabled="ocrRunning"
          @click="pasteFromClipboard"
        />
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="hidden"
          @change="onFile"
        >
        <input
          ref="cameraInput"
          type="file"
          accept="image/*"
          capture="environment"
          class="hidden"
          @change="onFile"
        >
        <span
          v-if="ocrRunning"
          class="text-sm text-muted"
        >
          {{ ocrProgress === null ? $t('tools.fishing.merrick.ocrLoading') : $t('tools.fishing.merrick.ocrRunning', { progress: ocrProgress, ...ocrPass }) }}
        </span>
      </div>
    </UCard>

    <h2 class="text-2xl font-pirate mb-4">
      {{ $t('tools.fishing.merrick.listTitle') }}
    </h2>
    <MerrickQuestEditor v-model="dishes" />

    <div class="mt-6 flex flex-col items-start gap-2">
      <UButton
        size="lg"
        icon="i-lucide-share-2"
        :label="$t('tools.fishing.merrick.create')"
        :loading="creating"
        :disabled="!isValid"
        @click="create"
      />
      <p class="text-xs text-muted">
        {{ $t('tools.fishing.merrick.expiry') }}
      </p>
    </div>
  </UContainer>
</template>
