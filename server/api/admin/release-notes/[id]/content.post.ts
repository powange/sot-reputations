import { parse as parseHtml } from 'node-html-parser'
import { requireAdmin } from '../../../../utils/admin'
import { getReleaseNoteById, updateReleaseNoteContent } from '../../../../utils/release-notes-db'

function htmlToMarkdown(html: string): string {
  const root = parseHtml(html)

  // Chercher le contenu principal de la release note
  // Structure SoT : article.article > div.article__content > div.article__content-inner
  const contentEl = root.querySelector('.article__content-inner')
    || root.querySelector('.article__content')
    || root.querySelector('article.article')
    || root.querySelector('main')
    || root

  let markdown = ''

  function processNode(node: ReturnType<typeof parseHtml>): string {
    if (node.nodeType === 3) { // Text node
      return node.text
    }

    // Ignorer le header de page (titre générique "Release Notes" + version)
    const classList = node.getAttribute?.('class') || ''
    if (classList.includes('page-header') || classList.includes('breadcrumb') || classList.includes('cookie')) {
      return ''
    }

    const tag = node.tagName?.toLowerCase()
    const children = node.childNodes.map(processNode).join('')

    switch (tag) {
      case 'h1': return `# ${children.trim()}\n\n`
      case 'h2': return `## ${children.trim()}\n\n`
      case 'h3': return `### ${children.trim()}\n\n`
      case 'h4': return `#### ${children.trim()}\n\n`
      case 'p': return `${children.trim()}\n\n`
      case 'strong':
      case 'b': return `**${children.trim()}**`
      case 'em':
      case 'i': return `*${children.trim()}*`
      case 'ul': return `${children}\n`
      case 'ol': return `${children}\n`
      case 'li': return `- ${children.trim()}\n`
      case 'br': return '\n'
      case 'a': {
        const href = node.getAttribute('href') || ''
        const ytMatch = href.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/)
        if (ytMatch) {
          return `\n\n<iframe width="560" height="315" src="https://www.youtube.com/embed/${ytMatch[1]}" frameborder="0" allowfullscreen></iframe>\n\n`
        }
        return href ? `[${children.trim()}](${href})` : children
      }
      case 'img': {
        const alt = node.getAttribute('alt') || ''
        const src = node.getAttribute('src') || ''
        return src ? `![${alt}](${src})` : ''
      }
      case 'iframe': {
        const src = node.getAttribute('src') || ''
        if (src.includes('youtube.com') || src.includes('youtu.be')) {
          return `\n\n<iframe width="560" height="315" src="${src}" frameborder="0" allowfullscreen></iframe>\n\n`
        }
        return ''
      }
      case 'div':
      case 'section':
      case 'article':
      case 'span':
        return children
      case 'script':
      case 'style':
      case 'nav':
      case 'header':
      case 'footer':
      case 'svg':
      case 'button':
        return ''
      default:
        return children
    }
  }

  markdown = processNode(contentEl)

  // Supprimer les sections génériques (non spécifiques au patch note)
  const sectionsToRemove = [
    /#{1,4}\s*Connect With Us:?\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi,
    /#{1,4}\s*Download and Installation\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi,
    /#{1,4}\s*Known Issues\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi,
    /#{1,4}\s*Full Release Notes\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi
  ]
  for (const regex of sectionsToRemove) {
    markdown = markdown.replace(regex, '')
  }

  // Nettoyer : supprimer les lignes vides multiples
  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = Number(getRouterParam(event, 'id'))
  if (!id || isNaN(id)) {
    throw createError({ statusCode: 400, message: 'ID invalide' })
  }

  const note = getReleaseNoteById(id)
  if (!note) {
    throw createError({ statusCode: 404, message: 'Release note non trouvée' })
  }

  // Fetch le contenu depuis le site SoT
  const url = `https://www.seaofthieves.com/release-notes/${note.version}`
  let html: string
  try {
    html = await $fetch<string>(url, {
      responseType: 'text',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    })
  } catch (err: unknown) {
    throw createError({
      statusCode: 502,
      message: `Impossible de récupérer le contenu depuis ${url}: ${err instanceof Error ? err.message : String(err)}`
    })
  }

  const content = htmlToMarkdown(html)
  if (!content || content.length < 50) {
    throw createError({
      statusCode: 422,
      message: 'Le contenu récupéré semble vide ou trop court'
    })
  }

  updateReleaseNoteContent(id, content)

  return {
    success: true,
    contentLength: content.length
  }
})
