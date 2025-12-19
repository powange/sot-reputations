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
const importJsonText = ref('')
const isImporting = ref(false)

async function handleImport() {
  if (!importJsonText.value.trim()) {
    toast.add({ title: t('common.error'), description: 'JSON requis', color: 'error' })
    return
  }

  let jsonData: unknown
  try {
    jsonData = JSON.parse(importJsonText.value)
  } catch {
    toast.add({ title: t('common.error'), description: 'JSON invalide', color: 'error' })
    return
  }

  isImporting.value = true
  try {
    await $fetch('/api/import', {
      method: 'POST',
      body: {
        username: props.username,
        password: '',
        jsonData
      }
    })
    toast.add({ title: t('import.success'), description: t('import.successMessage', { count: '' }), color: 'success' })
    isOpen.value = false
    importJsonText.value = ''
    emit('imported')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: t('import.error'), description: err.data?.message || t('common.error'), color: 'error' })
  } finally {
    isImporting.value = false
  }
}

// Reset le texte quand on ferme la modal
watch(isOpen, (open) => {
  if (!open) {
    importJsonText.value = ''
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
          <UFormField :label="$t('import.jsonData')">
            <UTextarea
              v-model="importJsonText"
              :placeholder="$t('import.jsonPlaceholder')"
              :rows="10"
              class="w-full"
            />
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
