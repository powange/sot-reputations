import { parse as parseHtml } from 'node-html-parser'
import { requireAdmin } from '../../../../utils/admin'
import { getReleaseNoteById, updateReleaseNoteContent } from '../../../../utils/release-notes-db'

function htmlFragmentToMarkdown(html: string): string {
  const root = parseHtml(html)

  function processNode(node: ReturnType<typeof parseHtml>): string {
    if (node.nodeType === 3) { // Text node
      return node.text
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

  return processNode(root)
}

interface AppPropsBlock {
  '#Type'?: string
  '#Name'?: string
  Title?: string
  BodyText?: string
  YouTubeVideoCode?: string
  Questions?: { Question?: string, Answer?: string }[]
  data?: {
    ArticlePageHeader?: { Title?: string, SnippetText?: string }
    ArticleContentComponents?: AppPropsBlock[]
  }
}

function extractJsonFromHtml(html: string): Record<string, unknown> | null {
  const idx = html.indexOf('APP_PROPS')
  if (idx === -1) return null
  const eqIdx = html.indexOf('=', idx)
  const jsonStart = html.indexOf('{', eqIdx)
  if (jsonStart === -1) return null

  // Matching de accolades pour trouver la fin du JSON
  let depth = 0
  let jsonEnd = -1
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++
    else if (html[i] === '}') {
      depth--
      if (depth === 0) {
        jsonEnd = i + 1
        break
      }
    }
  }
  if (jsonEnd === -1) return null

  try {
    return JSON.parse(html.substring(jsonStart, jsonEnd))
  } catch {
    return null
  }
}

function extractFromAppProps(html: string): string | null {
  const props = extractJsonFromHtml(html)
  if (!props) return null

  try {
    const components = props?.data?.components as AppPropsBlock[] | undefined
    if (!components) return null

    let markdown = ''

    for (const comp of components) {
      // Structure : comp.data contient #Type, ArticlePageHeader, ArticleContentComponents
      const compData = comp.data || comp
      const type = compData['#Type'] || comp['#Type']
      if (type !== 'Article') continue

      // Titre depuis ArticlePageHeader
      const header = compData.ArticlePageHeader as { Title?: string, SnippetText?: string } | undefined
      const title = header?.SnippetText || header?.Title
      if (title && title !== 'Release Notes') {
        markdown += `# ${title}\n\n`
      }

      // Contenu depuis ArticleContentComponents
      const blocks = compData.ArticleContentComponents as AppPropsBlock[] | undefined
      if (!blocks) continue

      for (const block of blocks) {
        const blockType = block['#Type']

        switch (blockType) {
          case 'ArticleTextBlock':
            if (block.BodyText) {
              markdown += htmlFragmentToMarkdown(block.BodyText)
            }
            break
          case 'ArticleSectionTitle':
            if (block.Title) {
              markdown += `## ${block.Title}\n\n`
            }
            break
          case 'ArticleVideoPanel':
            if (block.YouTubeVideoCode) {
              markdown += `\n\n<iframe width="560" height="315" src="https://www.youtube.com/embed/${block.YouTubeVideoCode}" frameborder="0" allowfullscreen></iframe>\n\n`
            }
            if (block.BodyText) {
              markdown += htmlFragmentToMarkdown(block.BodyText)
            }
            break
          case 'FeatureBlock':
            if (block.Title) {
              markdown += `## ${block.Title}\n\n`
            }
            if (block.BodyText) {
              markdown += htmlFragmentToMarkdown(block.BodyText)
            }
            break
          case 'Faq':
            if (block.Questions) {
              for (const q of block.Questions) {
                if (q.Question) {
                  markdown += `### ${q.Question}\n\n`
                }
                if (q.Answer) {
                  markdown += htmlFragmentToMarkdown(q.Answer)
                }
              }
            }
            break
        }
      }
    }

    return markdown || null
  } catch {
    return null
  }
}

function htmlToMarkdown(html: string): string {
  // Essayer d'abord l'extraction depuis APP_PROPS (pages React/SPA)
  let markdown = extractFromAppProps(html)

  if (!markdown) {
    // Fallback : extraction depuis le HTML statique
    const root = parseHtml(html)
    const contentEl = root.querySelector('.article__content-inner')
      || root.querySelector('.article__content')
      || root.querySelector('article.article')
      || root.querySelector('main')
      || root

    // Ignorer les sections non pertinentes
    const classList = contentEl.getAttribute?.('class') || ''
    if (classList.includes('page-header') || classList.includes('breadcrumb') || classList.includes('cookie')) {
      markdown = ''
    } else {
      markdown = htmlFragmentToMarkdown(contentEl.toString())
    }
  }

  if (!markdown) return ''

  // Supprimer les sections génériques (non spécifiques au patch note)
  const sectionsToRemove = [
    /#{1,4}\s*Connect With Us:?\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi,
    /#{1,4}\s*Download and Installation\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi,
    /#{1,4}\s*Known Issues\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi,
    /#{1,4}\s*Full Release Notes\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi,
    /#{1,4}\s*Looking For Crew\??\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi
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
  const url = `https://www.seaofthieves.com/release-notes/${note.display_version || note.version}`
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
