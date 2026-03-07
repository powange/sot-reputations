import { requireAdmin } from '../../../utils/admin'
import { getReleaseNoteByVersion, insertReleaseNote } from '../../../utils/release-notes-db'

interface ForumTopic {
  version: string
  date: string
}

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
}

// Liste complète des versions connues (source: wiki Sea of Thieves)
// Les nouvelles versions sont récupérées dynamiquement depuis le forum
const KNOWN_VERSIONS: ForumTopic[] = [
  { version: '3.6.2', date: '2026-03-05' },
  { version: '3.6.1', date: '2026-01-22' },
  { version: '3.6.0.1', date: '2025-12-18' },
  { version: '3.6.0', date: '2025-12-11' },
  { version: '3.5.3', date: '2025-11-13' },
  { version: '3.5.2.1', date: '2025-10-24' },
  { version: '3.5.2', date: '2025-10-16' },
  { version: '3.5.1', date: '2025-09-18' },
  { version: '3.5.0', date: '2025-08-14' },
  { version: '3.4.2', date: '2025-07-17' },
  { version: '3.4.1', date: '2025-06-19' },
  { version: '3.4.0.1', date: '2025-06-02' },
  { version: '3.4.0', date: '2025-05-22' },
  { version: '3.3.2.2', date: '2025-05-12' },
  { version: '3.3.2.1', date: '2025-05-01' },
  { version: '3.3.2', date: '2025-04-24' },
  { version: '3.3.1.1', date: '2025-04-08' },
  { version: '3.3.1', date: '2025-03-27' },
  { version: '3.3.0.1', date: '2025-02-27' },
  { version: '3.3.0', date: '2025-02-20' },
  { version: '3.2.3', date: '2025-01-23' },
  { version: '3.2.2', date: '2024-12-12' },
  { version: '3.2.1.1', date: '2024-11-28' },
  { version: '3.2.1', date: '2024-11-18' },
  { version: '3.2.0.1', date: '2024-10-31' },
  { version: '3.2.0', date: '2024-10-17' },
  { version: '3.1.2.1', date: '2024-09-26' },
  { version: '3.1.2', date: '2024-09-19' },
  { version: '3.1.1', date: '2024-08-22' },
  { version: '3.1.0.1', date: '2024-08-06' },
  { version: '3.1.0', date: '2024-07-25' },
  { version: '3.0.2', date: '2024-06-20' },
  { version: '3.0.1', date: '2024-05-23' },
  { version: '3.0.0.1', date: '2024-05-07' },
  { version: '3.0.0', date: '2024-04-30' },
  { version: '2.10.3', date: '2024-04-25' },
  { version: '2.10.2', date: '2024-03-14' },
  { version: '2.10.1', date: '2024-02-19' },
  { version: '2.10.0', date: '2024-01-23' },
  { version: '2.9.2.1', date: '2023-12-14' },
  { version: '2.9.2', date: '2023-12-07' },
  { version: '2.9.1.1', date: '2023-11-28' },
  { version: '2.9.1', date: '2023-11-16' },
  { version: '2.9.0.1', date: '2023-10-30' },
  { version: '2.9.0', date: '2023-10-19' },
  { version: '2.8.5.1', date: '2023-09-07' },
  { version: '2.8.5', date: '2023-08-31' },
  { version: '2.8.4.1', date: '2023-08-03' },
  { version: '2.8.4', date: '2023-07-20' },
  { version: '2.8.3', date: '2023-06-15' },
  { version: '2.7.2', date: '2023-01-19' },
  { version: '2.7.1', date: '2022-12-15' },
  { version: '2.7.0.1', date: '2022-12-09' },
  { version: '2.7.0', date: '2022-11-22' },
  { version: '2.6.3.1', date: '2022-11-03' },
  { version: '2.6.3', date: '2022-10-20' },
  { version: '2.6.2.1', date: '2022-10-13' },
  { version: '2.6.2', date: '2022-09-29' },
  { version: '2.6.1.1', date: '2022-09-15' },
  { version: '2.6.1', date: '2022-09-01' },
  { version: '2.6.0.1', date: '2022-08-18' },
  { version: '2.6.0', date: '2022-08-04' },
  { version: '2.5.3.1', date: '2022-07-11' },
  { version: '2.5.3', date: '2022-06-24' },
  { version: '2.5.2.1', date: '2022-05-27' },
  { version: '2.5.2', date: '2022-05-12' },
  { version: '2.5.1.2', date: '2022-04-28' },
  { version: '2.5.1.1', date: '2022-04-21' },
  { version: '2.5.1', date: '2022-04-07' },
  { version: '2.5.0.1', date: '2022-03-24' },
  { version: '2.5.0', date: '2022-03-10' },
  { version: '2.4.2', date: '2022-02-10' },
  { version: '2.4.1', date: '2022-01-20' },
  { version: '2.4.0', date: '2021-12-08' },
  { version: '2.3.2', date: '2021-11-11' },
  { version: '2.3.1.1', date: '2021-10-20' },
  { version: '2.3.1', date: '2021-10-14' },
  { version: '2.3.0.1', date: '2021-09-29' },
  { version: '2.3.0', date: '2021-09-23' },
  { version: '2.2.1.1', date: '2021-08-25' },
  { version: '2.2.1', date: '2021-08-17' },
  { version: '2.2.0.2', date: '2021-07-07' },
  { version: '2.2.0.1', date: '2021-06-26' },
  { version: '2.2.0', date: '2021-06-22' },
  { version: '2.1.1.1', date: '2021-05-13' },
  { version: '2.1.1', date: '2021-05-06' },
  { version: '2.1.0', date: '2021-04-15' },
  { version: '2.0.23', date: '2021-03-18' },
  { version: '2.0.22', date: '2021-02-18' },
  { version: '2.0.21.1', date: '2021-02-09' },
  { version: '2.0.21', date: '2021-01-28' },
  { version: '2.0.20', date: '2020-12-09' },
  { version: '2.0.19.2', date: '2020-11-18' },
  { version: '2.0.19.1', date: '2020-10-30' },
  { version: '2.0.19', date: '2020-10-28' },
  { version: '2.0.18', date: '2020-09-09' },
  { version: '2.0.17.2', date: '2020-08-19' },
  { version: '2.0.17.1', date: '2020-08-05' },
  { version: '2.0.17', date: '2020-07-29' },
  { version: '2.0.16', date: '2020-06-17' },
  { version: '2.0.15', date: '2020-05-27' },
  { version: '2.0.14.1', date: '2020-04-22' },
  { version: '2.0.14', date: '2020-04-22' },
  { version: '2.0.13', date: '2020-03-20' },
  { version: '2.0.12', date: '2020-02-19' },
  { version: '2.0.11', date: '2020-01-15' },
  { version: '2.0.10', date: '2019-12-11' },
  { version: '2.0.9', date: '2019-11-20' },
  { version: '2.0.8', date: '2019-10-16' },
  { version: '2.0.7', date: '2019-09-11' },
  { version: '2.0.6', date: '2019-08-14' },
  { version: '2.0.5', date: '2019-07-17' },
  { version: '2.0.4', date: '2019-06-19' },
  { version: '2.0.3', date: '2019-06-11' },
  { version: '2.0.2', date: '2019-05-08' },
  { version: '2.0.1', date: '2019-04-30' },
  { version: '1.4.5', date: '2019-04-10' },
  { version: '1.4.4', date: '2019-03-20' },
  { version: '1.4.3', date: '2019-02-06' },
  { version: '1.4.2', date: '2019-01-16' },
  { version: '1.4.1', date: '2018-12-19' },
  { version: '1.4.0', date: '2018-11-28' },
  { version: '1.3.1', date: '2018-10-10' },
  { version: '1.3.0', date: '2018-09-27' },
  { version: '1.2.0', date: '2018-07-31' },
  { version: '1.1.1', date: '2018-06-20' },
  { version: '1.1.0', date: '2018-05-29' },
  { version: '1.0.3', date: '2018-04-24' },
  { version: '1.0.2', date: '2018-04-04' },
  { version: '1.0.1', date: '2018-03-27' },
  { version: '1.0.0', date: '2018-03-20' }
]

function parseTopicsFromForumHtml(html: string): ForumTopic[] {
  const topics: ForumTopic[] = []

  // Extraire slug + timestamp depuis le JSON embarqué dans le SSR du forum
  // Format: "slug":"182901/release-notes-3-6-2","timestamp":1772717866772
  const topicRegex = /"slug":"\d+\/release-notes-([\d-]+)","timestamp":(\d+)/g

  for (const match of html.matchAll(topicRegex)) {
    const version = match[1].replace(/-/g, '.')
    const date = new Date(Number(match[2])).toISOString().split('T')[0]

    if (!topics.some(t => t.version === version)) {
      topics.push({ version, date })
    }
  }

  return topics
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // Étape 1 : Scraper le forum pour récupérer les versions récentes
  // (permet de détecter de nouvelles versions non encore dans KNOWN_VERSIONS)
  const forumTopics: ForumTopic[] = []
  try {
    const html = await $fetch<string>(
      'https://www.seaofthieves.com/community/forums/category/60/release-notes-discussion',
      { responseType: 'text', headers: FETCH_HEADERS }
    )
    forumTopics.push(...parseTopicsFromForumHtml(html))
  } catch (error) {
    console.error('Erreur scraping forum:', error)
  }

  // Étape 2 : Fusionner avec la liste connue (forum a priorité pour les dates)
  const allTopics = new Map<string, ForumTopic>()

  // D'abord les versions connues (hardcodées)
  for (const topic of KNOWN_VERSIONS) {
    allTopics.set(topic.version, topic)
  }

  // Puis le forum (écrase les dates si version déjà connue, ajoute les nouvelles)
  for (const topic of forumTopics) {
    allTopics.set(topic.version, topic)
  }

  // Étape 3 : Insérer en DB
  let added = 0
  for (const topic of allTopics.values()) {
    const existing = getReleaseNoteByVersion(topic.version)
    if (!existing) {
      insertReleaseNote(topic.version, topic.date)
      added++
    }
  }

  return {
    success: true,
    totalFound: allTopics.size,
    added
  }
})
