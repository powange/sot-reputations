import type { H3Event } from 'h3'
import { getQuery, setHeader } from 'h3'

/**
 * Détecte si la réponse d'un endpoint « agent » doit être rendue en Markdown
 * plutôt qu'en JSON. Activé via le paramètre d'URL `?format=md` ou
 * `?format=markdown` (insensible à la casse). Pratique pour un agent IA qui
 * exploite mieux du texte structuré qu'un gros objet JSON.
 */
export function wantsMarkdown(event: H3Event): boolean {
  const fmt = getQuery(event).format
  if (typeof fmt !== 'string') return false
  const v = fmt.trim().toLowerCase()
  return v === 'md' || v === 'markdown'
}

/**
 * Positionne l'en-tête `Content-Type: text/markdown` puis renvoie la chaîne
 * telle quelle. À retourner directement depuis le endpoint.
 */
export function sendMarkdown(event: H3Event, markdown: string): string {
  setHeader(event, 'content-type', 'text/markdown; charset=utf-8')
  return markdown
}

/**
 * Normalise un texte destiné à une ligne Markdown : replie les sauts de ligne
 * en espaces (pour ne pas casser une puce / une cellule) et coupe les blancs.
 */
export function mdInline(text: string | null | undefined): string {
  if (!text) return ''
  return text.replace(/\s*\r?\n\s*/g, ' ').trim()
}

/**
 * Ajoute un titre à `lines` en garantissant une ligne vide avant (sauf en début
 * de document) et après — sinon un titre collé à une liste casse certains
 * parseurs Markdown stricts (CommonMark).
 */
export function pushMdHeading(lines: string[], heading: string): void {
  if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('')
  lines.push(heading, '')
}
