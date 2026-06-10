import { parse as parseHtml } from 'node-html-parser'

export const RELEASE_NOTES_FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5'
}

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
  'Title'?: string
  'BodyText'?: string
  'YouTubeVideoCode'?: string
  'Questions'?: { Question?: string, Answer?: string }[]
  'data'?: {
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

// Parcourt les composants APP_PROPS et retourne le bloc Article (en-tête + contenu)
function findArticleComponent(html: string): AppPropsBlock | null {
  const props = extractJsonFromHtml(html)
  if (!props) return null

  const components = props?.data?.components as AppPropsBlock[] | undefined
  if (!components) return null

  for (const comp of components) {
    const compData = comp.data || comp
    const type = compData['#Type'] || comp['#Type']
    if (type === 'Article') return comp
  }

  return null
}

function extractFromAppProps(html: string): string | null {
  try {
    const comp = findArticleComponent(html)
    if (!comp) return null

    const compData = comp.data || comp

    let markdown = ''

    // Titre depuis ArticlePageHeader
    const header = compData.ArticlePageHeader as { Title?: string, SnippetText?: string } | undefined
    const title = header?.SnippetText || header?.Title
    if (title && title !== 'Release Notes') {
      markdown += `# ${title}\n\n`
    }

    // Contenu depuis ArticleContentComponents
    const blocks = compData.ArticleContentComponents as AppPropsBlock[] | undefined
    if (!blocks) return markdown || null

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

    return markdown || null
  } catch {
    return null
  }
}

// Extrait le numéro de version depuis l'en-tête de l'article (SnippetText).
// Ex: "Hotfix – 3.7.2.1" -> "3.7.2.1", "3.7.2" -> "3.7.2"
export function extractLatestVersionFromHtml(html: string): string | null {
  const comp = findArticleComponent(html)
  if (!comp) return null

  const compData = comp.data || comp
  const header = compData.ArticlePageHeader as { Title?: string, SnippetText?: string } | undefined
  const snippet = header?.SnippetText
  if (!snippet) return null

  const match = snippet.match(/\d+(?:\.\d+)+/)
  return match ? match[0] : null
}

export function htmlToMarkdown(html: string): string {
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
    /#{1,4}\s*Looking For Crew\??\s*\n[\s\S]*?(?=\n#{1,4}\s|\n*$)/gi,
    // Paragraphe générique renvoyant vers l'article "Known Issues" du support
    /\n*To learn more about known issues[^\n]*/gi
  ]
  for (const regex of sectionsToRemove) {
    markdown = markdown.replace(regex, '')
  }

  // Nettoyer : supprimer les lignes vides multiples
  return markdown.replace(/\n{3,}/g, '\n\n').trim()
}
