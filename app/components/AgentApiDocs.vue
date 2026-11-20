<script setup lang="ts">
// Documentation de l'API des agents (authentification, formats, points d'accès et exemples),
// partagée entre la page publique /api-docs et l'administration des jetons.
import { AGENT_API_SECTIONS } from '~/utils/agent-api-docs'

// Afficher comment obtenir un jeton (page publique : les jetons sont créés par un admin)
defineProps<{ tokenHint?: boolean }>()

const origin = computed(() => useRequestURL().origin)
</script>

<template>
  <div class="space-y-4 text-sm">
    <p v-if="tokenHint">
      L'API nécessite un jeton. Pour obtenir un jeton, contactez l'administrateur.
    </p>
    <p>
      Authentifiez chaque requête, au choix, avec l'en-tête
      <code class="px-1.5 py-0.5 rounded bg-elevated">Authorization: Bearer &lt;jeton&gt;</code>
      (recommandé) ou le paramètre d'URL
      <code class="px-1.5 py-0.5 rounded bg-elevated">?token=&lt;jeton&gt;</code>.
    </p>
    <p class="text-warning">
      ⚠️ Le paramètre d'URL est plus pratique mais moins sûr : le jeton apparaît dans les
      journaux d'accès et l'historique du navigateur. Préférez l'en-tête quand c'est possible.
    </p>
    <p>
      Réponse au format <strong>JSON</strong> par défaut. Ajoutez
      <code class="px-1.5 py-0.5 rounded bg-elevated">?format=md</code> (ou
      <code class="px-1.5 py-0.5 rounded bg-elevated">?format=markdown</code>) pour recevoir
      du <strong>Markdown</strong> à la place — pratique pour un agent IA qui exploite mieux du
      texte structuré. Cumulable avec le paramètre <code class="px-1.5 py-0.5 rounded bg-elevated">token</code>.
    </p>
    <p class="text-muted">
      Exemples de réponse JSON : vraies réponses, listes réduites à un ou deux éléments et
      contenus tronqués (les compteurs <code class="px-1.5 py-0.5 rounded bg-elevated">count</code>
      gardent leur valeur réelle). Erreurs : 401 sans jeton valide, 404 si la version, la
      faction, la campagne ou la catégorie n'existe pas.
    </p>
    <div
      v-for="section in AGENT_API_SECTIONS"
      :key="section.title"
    >
      <p class="font-medium mb-1">
        {{ section.title }}
      </p>
      <div class="space-y-3">
        <div
          v-for="endpoint in section.endpoints"
          :key="endpoint.path"
        >
          <p class="text-sm text-muted mb-1">
            {{ endpoint.description }}
          </p>
          <code class="block px-3 py-2 rounded bg-elevated break-all">GET {{ origin }}{{ endpoint.path }}</code>
          <details class="mt-1">
            <summary class="cursor-pointer text-xs text-muted hover:text-default select-none">
              Exemple de réponse JSON
            </summary>
            <pre class="mt-1 px-3 py-2 rounded bg-elevated text-xs overflow-x-auto max-h-96">{{ JSON.stringify(endpoint.example, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </div>
    <div>
      <p class="font-medium mb-1">
        Exemple (en-tête)
      </p>
      <code class="block px-3 py-2 rounded bg-elevated break-all whitespace-pre-wrap">curl -H "Authorization: Bearer &lt;jeton&gt;" {{ origin }}/api/agent/recommendations</code>
    </div>
    <div>
      <p class="font-medium mb-1">
        Exemple (URL)
      </p>
      <code class="block px-3 py-2 rounded bg-elevated break-all whitespace-pre-wrap">{{ origin }}/api/agent/recommendations?token=&lt;jeton&gt;</code>
    </div>
    <div>
      <p class="font-medium mb-1">
        Exemple (Markdown)
      </p>
      <code class="block px-3 py-2 rounded bg-elevated break-all whitespace-pre-wrap">curl -H "Authorization: Bearer &lt;jeton&gt;" "{{ origin }}/api/agent/recommendations?format=md"</code>
    </div>
  </div>
</template>
