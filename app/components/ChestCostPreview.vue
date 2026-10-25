<script setup lang="ts">
// Aperçu des données wiki d'UNE sous-catégorie du coffre (/admin/chest-costs) : coûts et
// prérequis à appliquer, items sans coût, items non rapprochés (nom anglais), pages wiki
// sans item (brouillons). La page en affiche un par sous-catégorie sélectionnée.
const props = defineProps<{
  scope: ChestCostScope
  // Sections affichées (choisies avant « Récupérer »).
  sections: ChestCostSection[]
}>()
// Données en base modifiées (coûts, brouillons, catégorie wiki) : la page rafraîchit les compteurs.
const emit = defineEmits<{ updated: [] }>()

const toast = useToast()
const uid = useId()

// Catégorie wiki interrogée : override mémorisé, sinon la sous-catégorie.
const wikiCategory = ref(props.scope.wikiCategory ?? props.scope.subcategory ?? '')
const fetching = ref(false)
const fetchError = ref<string | null>(null)
const applying = ref(false)
const savingMap = ref(false)
const result = ref<ChestCostFetchResult | null>(null)
// Lignes cochées (à appliquer). Clé = id d'item.
const selectedIds = ref<Set<number>>(new Set())

const scopeLabel = computed(() => `${props.scope.category} / ${props.scope.subcategory ?? '—'}`)
const show = (section: ChestCostSection) => props.sections.includes(section)

async function fetchCosts() {
  if (!wikiCategory.value.trim()) {
    fetchError.value = 'Catégorie wiki vide'
    return
  }
  fetching.value = true
  fetchError.value = null
  try {
    const res = await $fetch<ChestCostFetchResult>('/api/admin/chest-costs/fetch', {
      method: 'POST',
      body: { category: props.scope.category, subcategory: props.scope.subcategory, wikiCategory: wikiCategory.value.trim() }
    })
    result.value = res
    selectedTitles.value = new Set()
    // Par défaut : on coche les matchés dont le coût ou les prérequis changent réellement,
    // + les « sans coût » dont les prérequis changent (seuls les prérequis sont écrits).
    selectedIds.value = new Set([
      ...res.matched.filter(chestMatchedChanged).map(m => m.id),
      ...res.noCost.filter(chestPrereqsChanged).map(n => n.id)
    ])
    enNameInputs.value = Object.fromEntries(res.unmatched.map(u => [u.id, u.enName ?? '']))
    showUnchanged.value = false
  } catch (e) {
    fetchError.value = (e as { statusMessage?: string })?.statusMessage || 'Échec de la récupération'
  } finally {
    fetching.value = false
  }
}

defineExpose({ fetchCosts })

// Mémorise le nom de catégorie wiki pour cette sous-catégorie (persisté en base).
async function saveWikiMap() {
  savingMap.value = true
  try {
    await $fetch('/api/admin/chest-costs/wiki-map', {
      method: 'POST',
      body: { category: props.scope.category, subcategory: props.scope.subcategory, wikiCategory: wikiCategory.value.trim() }
    })
    toast.add({ title: `Catégorie wiki mémorisée (${scopeLabel.value})`, color: 'success' })
    emit('updated')
  } catch {
    toast.add({ title: 'Erreur lors de l\'enregistrement', color: 'error' })
  } finally {
    savingMap.value = false
  }
}

function toggle(id: number) {
  const set = new Set(selectedIds.value)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  selectedIds.value = set
}

// Lignes inchangées (coût et prérequis identiques) : rien à appliquer, masquées par défaut.
const showUnchanged = ref(false)
const changedMatched = computed(() => result.value?.matched.filter(chestMatchedChanged) ?? [])
const changedNoCost = computed(() => result.value?.noCost.filter(chestPrereqsChanged) ?? [])
const unchangedCount = computed(() => (result.value?.matched.length ?? 0) - changedMatched.value.length)
const visibleMatched = computed(() => showUnchanged.value ? (result.value?.matched ?? []) : changedMatched.value)

const allSelected = computed(() =>
  changedMatched.value.length > 0 && changedMatched.value.every(m => selectedIds.value.has(m.id))
)
// Nombre d'items (matchés + sans coût) pour lesquels le wiki donne des prérequis.
const prereqCount = computed(() =>
  result.value ? [...result.value.matched, ...result.value.noCost].filter(x => x.prereqs).length : 0
)
function toggleAll() {
  if (!result.value) return
  selectedIds.value = allSelected.value ? new Set() : new Set(changedMatched.value.map(m => m.id))
}

// Rien à montrer dans les sections choisies : bloc replié en une ligne.
const nothingToShow = computed(() => {
  const r = result.value
  if (!r) return false
  return !(show('matched') && changedMatched.value.length)
    && !(show('noCost') && changedNoCost.value.length)
    && !(show('unmatched') && r.unmatched.length)
    && !(show('wikiOnly') && r.wikiOnly.length)
})
const expanded = ref(false)

async function apply() {
  if (!result.value) return
  const toApply = result.value.matched.filter(m => selectedIds.value.has(m.id))
  // « Sans coût » cochés : prérequis seuls (aucun coût à écrire).
  const prereqsOnly = result.value.noCost.filter(n => selectedIds.value.has(n.id) && chestPrereqsChanged(n))
  if (!toApply.length && !prereqsOnly.length) {
    toast.add({ title: 'Aucune ligne sélectionnée', color: 'warning' })
    return
  }
  applying.value = true
  try {
    const res = await $fetch<{ updated: number }>('/api/admin/chest-costs/apply', {
      method: 'POST',
      body: {
        items: [
          ...toApply.map(m => chestPrereqsChanged(m) ? { id: m.id, cost: m.cost, prereqs: m.prereqs } : { id: m.id, cost: m.cost }),
          ...prereqsOnly.map(n => ({ id: n.id, prereqs: n.prereqs }))
        ]
      }
    })
    toast.add({ title: `${scopeLabel.value} : ${res.updated} item(s) mis à jour`, color: 'success' })
    emit('updated')
    // Nouvel aperçu (les lignes appliquées passent en « inchangé »).
    await fetchCosts()
  } catch {
    toast.add({ title: 'Erreur lors de l\'application', color: 'error' })
  } finally {
    applying.value = false
  }
}

// Pages wiki sans item : création d'items « source wiki » non publiés (brouillons),
// à publier ensuite depuis /admin/chest-wiki-items.
const selectedTitles = ref<Set<string>>(new Set())
const creatingDrafts = ref(false)

function toggleTitle(title: string) {
  const set = new Set(selectedTitles.value)
  if (set.has(title)) set.delete(title)
  else set.add(title)
  selectedTitles.value = set
}

const allTitlesSelected = computed(() =>
  !!result.value?.wikiOnly.length && result.value.wikiOnly.every(w => selectedTitles.value.has(w.title))
)
function toggleAllTitles() {
  if (!result.value) return
  selectedTitles.value = allTitlesSelected.value ? new Set() : new Set(result.value.wikiOnly.map(w => w.title))
}

async function createDrafts(all: boolean) {
  if (!result.value) return
  const titles = all ? result.value.wikiOnly.map(w => w.title) : [...selectedTitles.value]
  if (!titles.length) return
  // Items du site non rapprochés (souvent sans nom anglais) : une page wiki « orpheline »
  // peut être le même objet sous un autre nom -> doublon si on la crée.
  if (all && result.value.unmatched.length && !confirm(
    `${result.value.unmatched.length} item(s) du site ne sont pas rapprochés du wiki (souvent faute de nom anglais). `
    + 'Certaines pages peuvent correspondre à ces items et créeraient des doublons. Créer quand même les '
    + `${titles.length} pages ?`
  )) return
  creatingDrafts.value = true
  try {
    const res = await $fetch<{ created: number, skipped: number }>('/api/admin/chest-costs/create-drafts', {
      method: 'POST',
      body: { category: props.scope.category, subcategory: props.scope.subcategory, titles }
    })
    toast.add({
      title: `${res.created} brouillon(s) créé(s)${res.skipped ? `, ${res.skipped} ignoré(s)` : ''}`,
      description: 'À publier depuis « Items du wiki ».',
      color: 'success'
    })
    selectedTitles.value = new Set()
    emit('updated')
    await fetchCosts()
  } catch (e) {
    const msg = (e as { statusMessage?: string })?.statusMessage || 'Échec de la création'
    toast.add({ title: msg, color: 'error' })
  } finally {
    creatingDrafts.value = false
  }
}

// Non matchés : saisie du nom EN (souvent absent) pour les rapprocher du wiki.
const enNameInputs = ref<Record<number, string>>({})
const savingEnName = ref<number | null>(null)

// Recherche du nom anglais : Google en mode IA (udm=50), requête pré-remplie.
// Pas d'API publique pour ce mode : on l'ouvre dans le navigateur de l'admin.
function englishNameSearchUrl(frName: string): string {
  return `https://www.google.com/search?udm=50&q=${encodeURIComponent(`Sea of Thieves nom en anglais de "${frName}"`)}`
}

async function copyName(name: string) {
  try {
    await navigator.clipboard.writeText(name)
    toast.add({ title: `Copié : ${name}`, color: 'success' })
  } catch {
    toast.add({ title: 'Impossible de copier automatiquement', color: 'error' })
  }
}

async function saveEnName(u: ChestCostUnmatched) {
  const name = (enNameInputs.value[u.id] ?? '').trim()
  if (!name) return
  savingEnName.value = u.id
  try {
    await $fetch('/api/admin/chest-costs/en-name', { method: 'POST', body: { id: u.id, name } })
    toast.add({ title: `Nom anglais enregistré : ${name}`, color: 'success' })
    // Nouvel aperçu : l'item doit maintenant être rapproché de sa page wiki.
    await fetchCosts()
  } catch (e) {
    const msg = (e as { statusMessage?: string })?.statusMessage || 'Échec de l\'enregistrement'
    toast.add({ title: msg, color: 'error' })
  } finally {
    savingEnName.value = null
  }
}

// Prompt IA : noms anglais de TOUS les non matchés en une fois. L'IA répond en JSON
// [{ id, fr, en }] ; l'id garantit l'attribution au bon item même si elle reformule le FR.
function buildAiPrompt(): string {
  const r = result.value
  if (!r) return ''
  const items = r.unmatched.map(u => `- id ${u.id} : ${u.name}${u.enName ? ` (nom anglais actuel, sans page wiki correspondante : ${u.enName})` : ''}`)
  const candidates = r.wikiOnly.map(w => `- ${w.title}`)
  return [
    'Tu es un expert du jeu Sea of Thieves.',
    `Pour chaque objet ci-dessous (catégorie « ${scopeLabel.value} », nom français officiel du jeu), donne son nom anglais officiel exact, tel qu'il apparaît dans le jeu en anglais et sur le wiki https://seaofthieves.wiki.gg.`,
    ...(candidates.length
      ? ['', 'Noms candidats (pages du wiki de cette catégorie encore sans correspondance) ; utilise l\'un d\'eux, à l\'identique, quand il correspond :', ...candidates]
      : []),
    '',
    'Objets :',
    ...items,
    '',
    'Si tu n\'es pas sûr d\'un nom, mets null plutôt que d\'inventer.',
    'Réponds UNIQUEMENT avec un tableau JSON, sans aucun texte autour, au format :',
    '[{"id": 123, "fr": "nom français", "en": "English name"}]'
  ].join('\n')
}

async function copyAiPrompt() {
  const prompt = buildAiPrompt()
  if (!prompt) return
  try {
    await navigator.clipboard.writeText(prompt)
    toast.add({ title: 'Prompt copié', description: 'Collez-le dans une IA, puis collez sa réponse JSON ci-dessous.', color: 'success' })
  } catch {
    toast.add({ title: 'Impossible de copier automatiquement', color: 'error' })
  }
}

// Réponse de l'IA collée : on extrait le tableau JSON (même entouré de texte ou d'un bloc
// de code), en ne gardant que les ids des non matchés et les noms anglais renseignés.
const aiAnswer = ref('')
const savingAi = ref(false)
interface AiMatch { id: number, fr: string, en: string }
const aiParsed = computed<{ matches: AiMatch[], ignored: number, error: string | null }>(() => {
  const text = aiAnswer.value.trim()
  const r = result.value
  if (!text || !r) return { matches: [], ignored: 0, error: null }
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start === -1 || end <= start) return { matches: [], ignored: 0, error: 'Aucun tableau JSON trouvé dans la réponse.' }
  let data: unknown
  try {
    data = JSON.parse(text.slice(start, end + 1))
  } catch {
    return { matches: [], ignored: 0, error: 'JSON invalide : vérifiez que la réponse a été collée en entier.' }
  }
  if (!Array.isArray(data)) return { matches: [], ignored: 0, error: 'La réponse doit être un tableau JSON.' }
  const byId = new Map(r.unmatched.map(u => [u.id, u]))
  const matches: AiMatch[] = []
  let ignored = 0
  for (const entry of data as Array<Record<string, unknown>>) {
    const u = byId.get(Number(entry?.id))
    const en = typeof entry?.en === 'string' ? entry.en.trim() : ''
    if (!u || !en || en === u.enName) {
      ignored++
      continue
    }
    matches.push({ id: u.id, fr: u.name, en })
  }
  return { matches, ignored, error: null }
})

async function applyAiAnswer() {
  const matches = aiParsed.value.matches
  if (!matches.length) return
  savingAi.value = true
  try {
    const res = await $fetch<{ updated: number }>('/api/admin/chest-costs/en-names', {
      method: 'POST',
      body: { items: matches.map(m => ({ id: m.id, name: m.en })) }
    })
    toast.add({ title: `${res.updated} nom(s) anglais enregistré(s)`, color: 'success' })
    aiAnswer.value = ''
    await fetchCosts()
  } catch {
    toast.add({ title: 'Échec de l\'enregistrement', color: 'error' })
  } finally {
    savingAi.value = false
  }
}
</script>

<template>
  <UCard class="mb-6">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold">
          {{ scopeLabel }}
          <span class="text-sm font-normal text-muted">({{ scope.withCost }}/{{ scope.count }} avec coût)</span>
        </h2>
        <div class="flex flex-wrap items-center gap-1">
          <UInput
            v-model="wikiCategory"
            size="xs"
            class="w-48"
            placeholder="Catégorie wiki (A|B)"
            :title="`Category:${wikiCategory || '…'} sur le wiki — plusieurs séparées par |`"
            @keydown.enter="fetchCosts"
          />
          <UButton
            icon="i-lucide-download"
            size="xs"
            variant="soft"
            :loading="fetching"
            :disabled="!wikiCategory.trim()"
            title="Récupérer cette sous-catégorie"
            aria-label="Récupérer cette sous-catégorie"
            @click="fetchCosts"
          />
          <UButton
            icon="i-lucide-save"
            size="xs"
            color="neutral"
            variant="outline"
            :loading="savingMap"
            title="Mémoriser la catégorie wiki (vide = retour à la sous-catégorie)"
            aria-label="Mémoriser la catégorie wiki"
            @click="saveWikiMap"
          />
        </div>
      </div>
    </template>

    <p
      v-if="fetching && !result"
      class="text-sm text-muted flex items-center gap-2"
    >
      <UIcon
        name="i-lucide-loader-2"
        class="w-4 h-4 animate-spin"
      />
      Récupération du wiki…
    </p>
    <p
      v-else-if="fetchError"
      class="text-sm text-error"
    >
      {{ fetchError }}
    </p>
    <p
      v-else-if="!result"
      class="text-sm text-muted"
    >
      En attente de récupération.
    </p>

    <template v-else>
      <!-- Récap -->
      <div class="flex flex-wrap gap-2 text-sm">
        <UBadge
          color="success"
          variant="subtle"
        >
          {{ result.counts.matched }} avec coût
        </UBadge>
        <UBadge
          color="neutral"
          variant="subtle"
        >
          {{ result.counts.noCost }} sans coût (wiki)
        </UBadge>
        <UBadge
          color="warning"
          variant="subtle"
        >
          {{ result.counts.unmatched }} non matchés
        </UBadge>
        <UBadge
          color="info"
          variant="subtle"
        >
          {{ result.counts.wikiOnly }} pages wiki orphelines
        </UBadge>
        <UBadge
          v-if="prereqCount"
          color="primary"
          variant="subtle"
        >
          {{ prereqCount }} avec prérequis
        </UBadge>
      </div>

      <div
        v-if="nothingToShow && !expanded"
        class="mt-3 text-sm text-muted flex flex-wrap items-center gap-2"
      >
        Rien à traiter dans les sections choisies.
        <UButton
          label="Afficher quand même"
          variant="link"
          color="neutral"
          size="xs"
          @click="expanded = true"
        />
      </div>

      <template v-else>
        <!-- Matchés avec coût -->
        <section
          v-if="show('matched')"
          class="mt-5"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <h3 class="font-semibold">
              Coûts trouvés ({{ result.matched.length }})
              <span class="text-sm font-normal text-muted">· {{ changedMatched.length }} à mettre à jour</span>
            </h3>
            <UButton
              icon="i-lucide-check-check"
              :label="`Appliquer (${selectedIds.size})`"
              color="success"
              size="sm"
              :loading="applying"
              :disabled="selectedIds.size === 0"
              @click="apply"
            />
          </div>

          <p
            v-if="!result.matched.length"
            class="text-sm text-muted"
          >
            Aucun item matché avec un coût.
          </p>
          <table
            v-else-if="visibleMatched.length"
            class="w-full text-sm"
          >
            <thead class="text-left text-muted border-b border-muted/20">
              <tr>
                <th class="py-1 pr-2 w-8">
                  <UCheckbox
                    :model-value="allSelected"
                    @update:model-value="toggleAll"
                  />
                </th>
                <th class="py-1 pr-2">
                  Item (EN)
                </th>
                <th class="py-1 pr-2">
                  Coût actuel
                </th>
                <th class="py-1">
                  Nouveau coût (wiki)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="m in visibleMatched"
                :key="m.id"
                class="border-b border-muted/10"
                :class="chestMatchedChanged(m) ? '' : 'opacity-60'"
              >
                <td class="py-1.5 pr-2">
                  <UCheckbox
                    :model-value="selectedIds.has(m.id)"
                    :disabled="!chestMatchedChanged(m)"
                    @update:model-value="toggle(m.id)"
                  />
                </td>
                <td class="py-1.5 pr-2">
                  <div class="flex items-center gap-2">
                    <ChestCostThumb
                      :image="m.image"
                      :wiki-image="m.wikiImage"
                      :alt="m.enName || m.name"
                    />
                    <div>
                      <div class="font-medium">
                        {{ m.enName || m.name }}
                      </div>
                      <div
                        v-if="m.enName && m.enName !== m.name"
                        class="text-xs text-muted"
                      >
                        {{ m.name }}
                      </div>
                    </div>
                  </div>
                </td>
                <td class="py-1.5 pr-2 text-muted">
                  {{ formatChestCost(m.currentCost) }}
                </td>
                <td class="py-1.5 font-medium">
                  {{ formatChestCost(m.cost) }}
                  <UBadge
                    v-if="!chestMatchedChanged(m)"
                    size="xs"
                    variant="subtle"
                    color="neutral"
                    class="ml-1"
                  >
                    inchangé
                  </UBadge>
                  <UBadge
                    v-else-if="sameChestCost(m.cost, m.currentCost)"
                    size="xs"
                    variant="subtle"
                    color="primary"
                    class="ml-1"
                  >
                    prérequis modifiés
                  </UBadge>
                  <UBadge
                    v-else-if="chestPrereqsChanged(m)"
                    size="xs"
                    variant="subtle"
                    color="primary"
                    class="ml-1"
                  >
                    + prérequis
                  </UBadge>
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-if="result.matched.length && !changedMatched.length && !showUnchanged"
            class="text-sm text-muted"
          >
            Tout est déjà à jour : coûts et prérequis identiques à la base.
          </p>
          <UButton
            v-if="unchangedCount"
            :label="showUnchanged ? `Masquer les inchangés (${unchangedCount})` : `Afficher les inchangés (${unchangedCount})`"
            :icon="showUnchanged ? 'i-lucide-eye-off' : 'i-lucide-eye'"
            variant="link"
            color="neutral"
            size="sm"
            class="mt-2"
            @click="showUnchanged = !showUnchanged"
          />
        </section>

        <!-- Non matchés -->
        <section
          v-if="show('unmatched') && result.unmatched.length"
          class="mt-6 pt-4 border-t border-muted/20"
        >
          <h3 class="font-semibold mb-2">
            Non matchés ({{ result.unmatched.length }})
          </h3>
          <p class="text-sm text-muted mb-2">
            Aucune page wiki ne correspond au nom EN de ces items (écart de nom, traduction EN
            manquante…). Saisissez le nom anglais (les pages wiki sans item sont proposées) :
            l'aperçu est relancé et l'item rapproché de sa page.
          </p>
          <div class="flex flex-wrap items-center gap-2 mb-3">
            <UButton
              icon="i-lucide-clipboard-copy"
              label="Copier le prompt IA"
              size="sm"
              variant="soft"
              @click="copyAiPrompt"
            />
            <span class="text-xs text-muted">
              Tous les noms en une fois : collez le prompt dans une IA, puis sa réponse ci-dessous.
            </span>
          </div>
          <datalist :id="`wiki-only-titles-${uid}`">
            <option
              v-for="w in result.wikiOnly"
              :key="w.title"
              :value="w.title"
            />
          </datalist>
          <ul class="text-sm space-y-2">
            <li
              v-for="u in result.unmatched"
              :key="u.id"
              class="flex flex-wrap items-center gap-2"
            >
              <ChestCostThumb
                :image="u.image"
                :alt="u.enName || u.name"
              />
              <div class="min-w-40 flex-1">
                <span class="font-medium">{{ u.name }}</span>
                <UButton
                  icon="i-lucide-copy"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="align-middle"
                  title="Copier le nom français"
                  aria-label="Copier le nom français"
                  @click="copyName(u.name)"
                />
                <UButton
                  icon="i-lucide-sparkles"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="align-middle"
                  :to="englishNameSearchUrl(u.name)"
                  target="_blank"
                  rel="noopener"
                  title="Chercher le nom anglais (Google, mode IA)"
                  aria-label="Chercher le nom anglais avec Google en mode IA"
                />
                <span
                  v-if="!u.enName"
                  class="text-warning text-xs"
                > (pas de nom EN)</span>
                <span
                  v-else-if="u.enName !== u.name"
                  class="text-muted text-xs"
                > · EN : {{ u.enName }}</span>
              </div>
              <form
                class="flex items-center gap-1"
                @submit.prevent="saveEnName(u)"
              >
                <UInput
                  v-model="enNameInputs[u.id]"
                  placeholder="Nom anglais"
                  size="xs"
                  class="w-64"
                  :ui="{ base: 'w-full' }"
                  :list="`wiki-only-titles-${uid}`"
                />
                <UButton
                  type="submit"
                  icon="i-lucide-check"
                  size="xs"
                  aria-label="Enregistrer le nom anglais"
                  :loading="savingEnName === u.id"
                  :disabled="!(enNameInputs[u.id] ?? '').trim() || (enNameInputs[u.id] ?? '').trim() === u.enName"
                />
              </form>
            </li>
          </ul>

          <!-- Réponse de l'IA au prompt : noms anglais en lot -->
          <div class="mt-4 pt-3 border-t border-muted/20 space-y-2">
            <UTextarea
              v-model="aiAnswer"
              :rows="3"
              autoresize
              placeholder="Collez ici la réponse JSON de l'IA : [{&quot;id&quot;: …, &quot;fr&quot;: &quot;…&quot;, &quot;en&quot;: &quot;…&quot;}]"
              class="w-full"
            />
            <p
              v-if="aiParsed.error"
              class="text-xs text-error"
            >
              {{ aiParsed.error }}
            </p>
            <template v-else-if="aiParsed.matches.length || aiParsed.ignored">
              <ul class="text-xs space-y-0.5">
                <li
                  v-for="m in aiParsed.matches"
                  :key="m.id"
                >
                  {{ m.fr }} <span class="text-muted">→</span> <span class="font-medium">{{ m.en }}</span>
                </li>
              </ul>
              <p
                v-if="aiParsed.ignored"
                class="text-xs text-muted"
              >
                {{ aiParsed.ignored }} entrée(s) ignorée(s) (nom absent ou null, id inconnu, ou nom identique).
              </p>
              <UButton
                icon="i-lucide-check-check"
                :label="`Enregistrer les noms anglais (${aiParsed.matches.length})`"
                size="sm"
                color="success"
                :loading="savingAi"
                :disabled="!aiParsed.matches.length"
                @click="applyAiAnswer"
              />
            </template>
          </div>
        </section>

        <!-- Sans coût sur le wiki -->
        <section
          v-if="show('noCost') && result.noCost.length"
          class="mt-6 pt-4 border-t border-muted/20"
        >
          <div class="flex items-center justify-between gap-2 mb-2">
            <h3 class="font-semibold">
              Sans coût sur le wiki ({{ result.noCost.length }})
              <span class="text-sm font-normal text-muted">· {{ changedNoCost.length }} prérequis à mettre à jour</span>
            </h3>
            <UButton
              icon="i-lucide-check-check"
              :label="`Appliquer (${selectedIds.size})`"
              color="success"
              size="sm"
              :loading="applying"
              :disabled="selectedIds.size === 0"
              @click="apply"
            />
          </div>
          <p class="text-sm text-muted mb-2">
            Items trouvés sur le wiki mais sans coût d'achat (par défaut, événement, récompense…).
            Seuls leurs prérequis sont comparés et appliqués ; « Appliquer » prend aussi les lignes
            cochées des coûts trouvés.
          </p>
          <ul class="text-sm space-y-1">
            <li
              v-for="n in result.noCost"
              :key="n.id"
              class="flex items-center gap-2"
              :class="chestPrereqsChanged(n) ? '' : 'opacity-60'"
            >
              <UCheckbox
                :model-value="selectedIds.has(n.id)"
                :disabled="!chestPrereqsChanged(n)"
                @update:model-value="toggle(n.id)"
              />
              <ChestCostThumb
                :image="n.image"
                :wiki-image="n.wikiImage"
                :alt="n.enName || n.name"
              />
              {{ n.enName || n.name }}
              <UBadge
                size="xs"
                variant="subtle"
                :color="chestPrereqsChanged(n) ? 'primary' : 'neutral'"
              >
                {{ chestPrereqsChanged(n) ? (n.currentPrereqs ? 'prérequis modifiés' : 'nouveaux prérequis') : (n.prereqs ? 'prérequis inchangés' : 'aucun prérequis') }}
              </UBadge>
            </li>
          </ul>
        </section>

        <!-- Pages wiki orphelines -->
        <section
          v-if="show('wikiOnly') && result.wikiOnly.length"
          class="mt-6 pt-4 border-t border-muted/20"
        >
          <div class="flex items-center justify-between gap-2 flex-wrap mb-2">
            <h3 class="font-semibold">
              Pages wiki sans item ({{ result.wikiOnly.length }})
            </h3>
            <div class="flex gap-2 flex-wrap">
              <UButton
                icon="i-lucide-file-plus"
                :label="`Créer la sélection (${selectedTitles.size})`"
                size="sm"
                variant="soft"
                :loading="creatingDrafts"
                :disabled="selectedTitles.size === 0 || creatingDrafts"
                @click="createDrafts(false)"
              />
              <UButton
                icon="i-lucide-files"
                :label="`Créer tous les manquants (${result.wikiOnly.length})`"
                size="sm"
                :loading="creatingDrafts"
                :disabled="creatingDrafts"
                @click="createDrafts(true)"
              />
            </div>
          </div>
          <p class="text-sm text-muted mb-2">
            Pages du wiki non rapprochées d'un item du catalogue (item non importé, ou écart de nom).
            Les items créés sont des brouillons non publiés (nom anglais, image du wiki), à publier depuis
            <NuxtLink
              to="/admin/chest-wiki-items"
              class="underline"
            >Items du wiki</NuxtLink>.
            Ils se rattachent automatiquement à l'item officiel quand un joueur l'importe.
          </p>
          <UAlert
            v-if="result.unmatched.length"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            class="mb-3"
            :title="`${result.unmatched.length} item(s) du site non rapprochés`"
            :description="`Souvent faute de nom anglais (${result.unmatched.slice(0, 5).map(u => u.name).join(', ')}${result.unmatched.length > 5 ? '…' : ''}). Une page ci-dessous peut être le même objet sous un autre nom : la créer ferait un doublon. Ajoutez d'abord le nom anglais (section Non matchés) ou décochez la page.`"
          />
          <label class="flex items-center gap-2 text-sm cursor-pointer mb-2 pb-2 border-b border-muted/20">
            <UCheckbox
              :model-value="allTitlesSelected"
              @update:model-value="toggleAllTitles"
            />
            {{ allTitlesSelected ? 'Tout désélectionner' : 'Tout sélectionner' }} ({{ result.wikiOnly.length }})
          </label>
          <ul class="text-sm space-y-1">
            <li
              v-for="w in result.wikiOnly"
              :key="w.title"
            >
              <label class="flex items-center gap-2 cursor-pointer">
                <UCheckbox
                  :model-value="selectedTitles.has(w.title)"
                  @update:model-value="toggleTitle(w.title)"
                />
                <ChestCostThumb
                  :wiki-image="w.image"
                  :alt="w.title"
                />
                <span class="font-medium">{{ w.title }}</span>
                <span class="text-muted"> · {{ formatChestCost(w.cost) }}</span>
              </label>
            </li>
          </ul>
        </section>
      </template>
    </template>
  </UCard>
</template>
