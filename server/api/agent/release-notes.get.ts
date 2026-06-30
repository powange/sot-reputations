import { requireApiToken } from '../../utils/api-token'
import { getReleaseNotesWithContent, type ReleaseNoteRow } from '../../utils/release-notes-db'
import { wantsMarkdown, sendMarkdown, pushMdHeading } from '../../utils/api-markdown'

/**
 * Rendu Markdown : un titre « ## version — date » par note, suivi de son
 * contenu (déjà au format Markdown). Notes triées de la plus récente à la plus
 * ancienne (comme le JSON).
 */
function renderReleaseNotesMarkdown(notes: ReleaseNoteRow[]): string {
  const lines: string[] = []
  pushMdHeading(lines, `# Notes de version (${notes.length})`)
  for (const n of notes) {
    const title = n.display_version || n.version
    pushMdHeading(lines, `## ${title}${n.date ? ` — ${n.date}` : ''}`)
    lines.push((n.content ?? '').trim(), '')
  }
  return lines.join('\n')
}

/**
 * Endpoint réservé aux agents (jeton d'API requis).
 * Renvoie l'intégralité des notes de version (patch notes) avec leur contenu.
 * Format : JSON par défaut, ou Markdown via `?format=md` (ou `markdown`).
 */
export default defineEventHandler((event) => {
  requireApiToken(event)

  const notes = getReleaseNotesWithContent()

  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderReleaseNotesMarkdown(notes))
  }

  return {
    count: notes.length,
    releaseNotes: notes
  }
})
