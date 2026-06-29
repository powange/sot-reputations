<script setup lang="ts">
const props = defineProps<{
  username: string
}>()

const emit = defineEmits<{
  imported: []
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const toast = useToast()

// URLs officielles SoT (forcées en /fr : l'import exige des données françaises).
const SOT_BASE = 'https://www.seaofthieves.com/fr/api/profilev2'
function openSot(path: 'reputation' | 'chest') {
  window.open(`${SOT_BASE}/${path}`, '_blank', 'noopener')
}

const reputationText = ref('')
const chestText = ref('')
const isImporting = ref(false)

function parseOrNull(raw: string): unknown | undefined {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

async function handleImport() {
  const repRaw = reputationText.value.trim()
  if (!repRaw) {
    toast.add({ title: t('common.error'), description: t('import.reputationRequired'), color: 'error' })
    return
  }
  const repParsed = parseOrNull(repRaw)
  if (repParsed === undefined || typeof repParsed !== 'object' || repParsed === null) {
    toast.add({ title: t('common.error'), description: t('import.invalidReputation'), color: 'error' })
    return
  }

  // Si on a collé le payload complet du bookmarklet ({ reputation, chest, ... }), on le
  // garde tel quel ; sinon le JSON collé EST la réputation -> on l'enveloppe.
  const hasWrapper = 'reputation' in (repParsed as Record<string, unknown>)
  const body: Record<string, unknown> = hasWrapper ? { ...(repParsed as Record<string, unknown>) } : { reputation: repParsed }

  const chestRaw = chestText.value.trim()
  if (chestRaw) {
    const chestParsed = parseOrNull(chestRaw)
    if (chestParsed === undefined || typeof chestParsed !== 'object' || chestParsed === null) {
      toast.add({ title: t('common.error'), description: t('import.invalidChest'), color: 'error' })
      return
    }
    body.chest = chestParsed
  }

  isImporting.value = true
  try {
    await $fetch('/api/import', {
      method: 'POST',
      body: {
        username: props.username,
        password: '',
        jsonData: body
      }
    })
    toast.add({ title: t('import.success'), description: t('import.successMessage', { count: '' }), color: 'success' })
    isOpen.value = false
    emit('imported')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: t('import.error'), description: err.data?.message || t('common.error'), color: 'error' })
  } finally {
    isImporting.value = false
  }
}

// Reset des champs à la fermeture.
watch(isOpen, (open) => {
  if (!open) {
    reputationText.value = ''
    chestText.value = ''
  }
})
</script>

<template>
  <UModal v-model:open="isOpen">
    <template #content>
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold">
            {{ $t('import.title') }}
          </h2>
        </template>
        <div class="space-y-4">
          <UAlert
            icon="i-lucide-info"
            color="info"
            :title="$t('import.tip')"
          >
            <template #description>
              <NuxtLink
                to="/tutoriel"
                class="underline"
                target="_blank"
              >
                {{ $t('nav.tutorial') }}
              </NuxtLink>
              - {{ $t('import.tipDescription') }}
            </template>
          </UAlert>

          <p class="text-sm text-muted">
            {{ $t('import.manualHint') }}
          </p>

          <!-- Réputation (obligatoire) -->
          <UFormField :label="$t('import.reputationLabel')">
            <div class="flex flex-col gap-2">
              <UButton
                :label="$t('import.openReputation')"
                icon="i-lucide-external-link"
                color="neutral"
                variant="outline"
                size="sm"
                class="self-start"
                @click="openSot('reputation')"
              />
              <UTextarea
                v-model="reputationText"
                :placeholder="$t('import.reputationPlaceholder')"
                :rows="6"
                class="w-full font-mono text-xs"
              />
            </div>
          </UFormField>

          <!-- Coffre (optionnel) -->
          <UFormField :label="$t('import.chestLabel')">
            <div class="flex flex-col gap-2">
              <UButton
                :label="$t('import.openChest')"
                icon="i-lucide-external-link"
                color="neutral"
                variant="outline"
                size="sm"
                class="self-start"
                @click="openSot('chest')"
              />
              <UTextarea
                v-model="chestText"
                :placeholder="$t('import.chestPlaceholder')"
                :rows="5"
                class="w-full font-mono text-xs"
              />
            </div>
          </UFormField>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              :label="$t('common.cancel')"
              color="neutral"
              variant="outline"
              @click="isOpen = false"
            />
            <UButton
              :label="$t('common.import')"
              icon="i-lucide-upload"
              :loading="isImporting"
              @click="handleImport"
            />
          </div>
        </template>
      </UCard>
    </template>
  </UModal>
</template>
