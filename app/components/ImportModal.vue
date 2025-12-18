<script setup lang="ts">
const props = defineProps<{
  username: string
}>()

const emit = defineEmits<{
  imported: []
}>()

const isOpen = defineModel<boolean>('open', { required: true })

const toast = useToast()
const importJsonText = ref('')
const isImporting = ref(false)

async function handleImport() {
  if (!importJsonText.value.trim()) {
    toast.add({ title: 'Erreur', description: 'JSON requis', color: 'error' })
    return
  }

  let jsonData: unknown
  try {
    jsonData = JSON.parse(importJsonText.value)
  } catch {
    toast.add({ title: 'Erreur', description: 'JSON invalide', color: 'error' })
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
    toast.add({ title: 'Succès', description: 'Données importées', color: 'success' })
    isOpen.value = false
    importJsonText.value = ''
    emit('imported')
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.add({ title: 'Erreur', description: err.data?.message || 'Erreur', color: 'error' })
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
            Importer mes données
          </h2>
        </template>
        <div class="space-y-4">
          <UAlert
            icon="i-lucide-info"
            color="info"
            title="Astuce"
          >
            <template #description>
              <NuxtLink
                to="/tutoriel"
                class="underline"
                target="_blank"
              >
                Voir le tutoriel
              </NuxtLink>
              pour savoir comment récupérer vos données.
            </template>
          </UAlert>
          <UFormField label="Données JSON">
            <UTextarea
              v-model="importJsonText"
              placeholder="Collez ici le JSON..."
              :rows="10"
              class="w-full"
            />
          </UFormField>
        </div>
        <template #footer>
          <div class="flex justify-end gap-2">
            <UButton
              label="Annuler"
              color="neutral"
              variant="outline"
              @click="isOpen = false"
            />
            <UButton
              label="Importer"
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
