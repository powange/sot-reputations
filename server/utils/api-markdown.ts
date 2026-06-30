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

/**
 * Décale tous les titres d'un fragment Markdown pour qu'ils s'imbriquent sous un
 * titre de niveau `parentLevel` : le titre le plus haut du fragment devient
 * `parentLevel + 1`, les autres suivent le même décalage (plafonné à h6). Les
 * titres dans les blocs de code (``` ou ~~~) sont ignorés.
 *
 * Sert à embarquer du Markdown externe (ex. patch notes, qui ont leurs propres
 * h1/h2) sans casser la hiérarchie du document englobant — sinon une IA qui lit
 * l'arbre des titres rattache mal les sections.
 */
export function demoteMdHeadings(markdown: string, parentLevel: number): string {
  const lines = markdown.split('\n')
  const headingRe = /^(#{1,6})(\s.*)$/
  const fenceRe = /^\s*(`{3,}|~{3,})/

  // 1re passe : niveau de titre le plus haut (hors blocs de code).
  let inFence = false
  let minLevel = Infinity
  for (const line of lines) {
    if (fenceRe.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = headingRe.exec(line)
    if (m) minLevel = Math.min(minLevel, m[1]!.length)
  }
  if (!Number.isFinite(minLevel)) return markdown // aucun titre

  const shift = (parentLevel + 1) - minLevel
  if (shift <= 0) return markdown // déjà assez profond

  // 2e passe : appliquer le décalage.
  inFence = false
  return lines.map((line) => {
    if (fenceRe.test(line)) {
      inFence = !inFence
      return line
    }
    if (inFence) return line
    const m = headingRe.exec(line)
    if (!m) return line
    return '#'.repeat(Math.min(6, m[1]!.length + shift)) + m[2]!
  }).join('\n')
}
