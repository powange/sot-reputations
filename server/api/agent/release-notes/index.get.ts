import { requireApiToken } from '../../../utils/api-token'
import { getReleaseNoteVersions, type ReleaseNoteSummary } from '../../../utils/release-notes-db'
import { releaseNoteAgentPath } from '../../../utils/release-notes-agent'
import { wantsMarkdown, sendMarkdown, pushMdHeading } from '../../../utils/api-markdown'

/**
 * Rendu Markdown : une puce « version — date » par note, avec le chemin de
 * l'endpoint qui renvoie son contenu. Notes triées de la plus récente à la plus ancienne.
 */
function renderVersionsMarkdown(notes: ReleaseNoteSummary[]): string {
  const lines: string[] = []
  pushMdHeading(lines, `# Notes de version (${notes.length})`)
  lines.push(`Contenu d'une version : \`GET /api/agent/release-notes/<version>\` ; dernière version : \`GET /api/agent/release-notes/latest\`.`, '')
  for (const n of notes) {
    const title = n.display_version || n.version
    lines.push(`- **${title}**${n.date ? ` — ${n.date}` : ''} : \`${releaseNoteAgentPath(n.version)}\``)
  }
  lines.push('')
  return lines.join('\n')
}

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie la liste des versions publiées avec leur date, sans le contenu
 * (voir `release-notes/[version]` et `release-notes/latest`).
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const notes = getReleaseNoteVersions()

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderVersionsMarkdown(notes))
  }

  return {
    count: notes.length,
    releaseNotes: notes.map(n => ({
      version: n.version,
      display_version: n.display_version,
      date: n.date,
      url: releaseNoteAgentPath(n.version)
    }))
  }
})
