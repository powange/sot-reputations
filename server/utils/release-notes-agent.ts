import type { H3Event } from 'h3'
import type { ReleaseNoteRow } from './release-notes-db'
import { wantsMarkdown, sendMarkdown, pushMdHeading, demoteMdHeadings } from './api-markdown'

/** Chemin de l'endpoint agent qui renvoie le contenu d'une version. */
export function releaseNoteAgentPath(version: string): string {
  return `/api/agent/release-notes/${encodeURIComponent(version)}`
}

/**
 * Rendu Markdown d'une note : titre « # version — date » puis son contenu (déjà en
 * Markdown). Les h1/h2 des patch notes officiels sont décalés sous ce titre pour
 * garder un arbre de titres cohérent.
 */
function renderReleaseNoteMarkdown(note: ReleaseNoteRow): string {
  const lines: string[] = []
  const title = note.display_version || note.version
  pushMdHeading(lines, `# Notes de version ${title}${note.date ? ` — ${note.date}` : ''}`)
  lines.push(demoteMdHeadings((note.content ?? '').trim(), 1), '')
  return lines.join('\n')
}

/** Réponse d'une note unique : JSON par défaut, Markdown via `?format=md`. */
export function sendReleaseNote(event: H3Event, note: ReleaseNoteRow) {
  if (wantsMarkdown(event)) {
    return sendMarkdown(event, renderReleaseNoteMarkdown(note))
  }
  return {
    version: note.version,
    display_version: note.display_version,
    date: note.date,
    content: note.content
  }
}
