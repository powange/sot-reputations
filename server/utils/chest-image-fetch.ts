import { isWikiImage, wikiThumb } from '#shared/utils/wiki-image'
import { USER_AGENT } from './sot-wiki'

// Images du wiki : miniature suffisante pour l'extraction (réduite ensuite à quelques
// dizaines de px) et bien plus légère que l'original en 1024 px.
const WIKI_THUMB_PX = 256
// wiki.gg répond 429 aux rafales : nouvelles tentatives espacées (Retry-After si fourni).
const WIKI_RETRIES = 3
const MAX_WAIT_MS = 8000

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Télécharge l'image d'un item du coffre (analyse des couleurs, signatures décor).
 * CDN officiel : simple GET. Wiki : miniature MediaWiki, User-Agent de l'appli et
 * nouvelles tentatives sur 429 / 5xx. Lève une erreur « HTTP <code> » en cas d'échec.
 */
export async function fetchChestImage(url: string, timeoutMs = 15000): Promise<Buffer> {
  if (!isWikiImage(url)) {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  }

  const target = wikiThumb(url, WIKI_THUMB_PX)
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(target, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeoutMs) })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    const transient = res.status === 429 || res.status >= 500
    if (!transient || attempt >= WIKI_RETRIES) throw new Error(`HTTP ${res.status}`)
    const retryAfter = Number(res.headers.get('retry-after'))
    await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt, MAX_WAIT_MS))
  }
}
