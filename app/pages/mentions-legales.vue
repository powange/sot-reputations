<script setup lang="ts">
const { t } = useI18n()
const config = useRuntimeConfig()

useHead({
  title: t('legal.title')
})
</script>

<template>
  <UContainer class="py-8 max-w-4xl">
    <div class="mb-8">
      <h1 class="text-3xl font-pirate mb-2">
        {{ $t('legal.title') }}
      </h1>
      <p class="text-muted">
        {{ $t('legal.lastUpdate') }}
      </p>
    </div>

    <div class="space-y-8">
      <!-- Editeur du site -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-user" class="w-5 h-5 text-primary" />
            {{ $t('legal.editor.title') }}
          </h2>
        </template>
        <div class="space-y-2 text-muted">
          <p>{{ $t('legal.editor.name') }}</p>
          <p>{{ $t('legal.editor.status') }}</p>
          <p>
            {{ $t('legal.editor.contact') }}
            <a href="mailto:powange@gmail.com" class="text-primary hover:underline">
              powange@gmail.com
            </a>
          </p>
        </div>
      </UCard>

      <!-- Hebergement -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-server" class="w-5 h-5 text-primary" />
            {{ $t('legal.hosting.title') }}
          </h2>
        </template>
        <div class="space-y-2 text-muted">
          <p>{{ $t('legal.hosting.provider') }}</p>
          <p>{{ $t('legal.hosting.address') }}</p>
        </div>
      </UCard>

      <!-- Propriete intellectuelle -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-copyright" class="w-5 h-5 text-primary" />
            {{ $t('legal.intellectual.title') }}
          </h2>
        </template>
        <div class="space-y-4 text-muted">
          <p>{{ $t('legal.intellectual.content') }}</p>
          <p>{{ $t('legal.intellectual.trademark') }}</p>
          <p class="text-sm italic">{{ $t('legal.intellectual.disclaimer') }}</p>
        </div>
      </UCard>

      <!-- Donnees personnelles -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-shield-check" class="w-5 h-5 text-primary" />
            {{ $t('legal.privacy.title') }}
          </h2>
        </template>
        <div class="space-y-4 text-muted">
          <p v-if="$t('legal.privacy.joke') !== 'legal.privacy.joke'" class="italic">
            {{ $t('legal.privacy.joke') }}
          </p>
          <div>
            <h3 class="font-medium text-foreground mb-2">{{ $t('legal.privacy.dataCollected.title') }}</h3>
            <ul class="list-disc list-inside space-y-1">
              <li>{{ $t('legal.privacy.dataCollected.gamertag') }}</li>
              <li>{{ $t('legal.privacy.dataCollected.visitorId') }}</li>
              <li>{{ $t('legal.privacy.dataCollected.reputation') }}</li>
            </ul>
          </div>
          <div>
            <h3 class="font-medium text-foreground mb-2">{{ $t('legal.privacy.purpose.title') }}</h3>
            <p>{{ $t('legal.privacy.purpose.content') }}</p>
          </div>
          <div>
            <h3 class="font-medium text-foreground mb-2">{{ $t('legal.privacy.retention.title') }}</h3>
            <p>{{ $t('legal.privacy.retention.content') }}</p>
          </div>
          <div>
            <h3 class="font-medium text-foreground mb-2">{{ $t('legal.privacy.rights.title') }}</h3>
            <p>{{ $t('legal.privacy.rights.content') }}</p>
          </div>
        </div>
      </UCard>

      <!-- Cookies -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-cookie" class="w-5 h-5 text-primary" />
            {{ $t('legal.cookies.title') }}
          </h2>
        </template>
        <div class="space-y-4 text-muted">
          <p>{{ $t('legal.cookies.description') }}</p>
          <ul class="list-disc list-inside space-y-1">
            <li>{{ $t('legal.cookies.session') }}</li>
            <li>{{ $t('legal.cookies.preferences') }}</li>
          </ul>
          <p>{{ $t('legal.cookies.noTracking') }}</p>
        </div>
      </UCard>

      <!-- Responsabilite -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-alert-triangle" class="w-5 h-5 text-primary" />
            {{ $t('legal.liability.title') }}
          </h2>
        </template>
        <div class="space-y-4 text-muted">
          <p>{{ $t('legal.liability.accuracy') }}</p>
          <p>{{ $t('legal.liability.availability') }}</p>
          <p>{{ $t('legal.liability.thirdParty') }}</p>
        </div>
      </UCard>

      <!-- Droit applicable -->
      <UCard>
        <template #header>
          <h2 class="text-xl font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-scale" class="w-5 h-5 text-primary" />
            {{ $t('legal.law.title') }}
          </h2>
        </template>
        <div class="text-muted">
          <p>{{ $t('legal.law.content') }}</p>
        </div>
      </UCard>
    </div>

    <!-- Retour -->
    <div class="mt-8">
      <UButton
        to="/"
        variant="ghost"
        icon="i-lucide-arrow-left"
        :label="$t('common.back')"
      />
    </div>
  </UContainer>
</template>
