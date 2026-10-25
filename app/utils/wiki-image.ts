// Images du wiki Sea of Thieves (items du coffre créés depuis le wiki). Elles ne passent
// PAS par IPX : wiki.gg limite (429) les téléchargements répétés depuis notre serveur.
// Le navigateur les charge directement, en miniature générée par MediaWiki.
const WIKI_IMAGE_RE = /^https:\/\/seaofthieves\.wiki\.gg\/images\/([^/?#]+)(\?[^#]*)?$/

export function isWikiImage(url: string | null | undefined): boolean {
  return !!url && WIKI_IMAGE_RE.test(url)
}

/**
 * Miniature MediaWiki d'une image du wiki : /images/X.png -> /images/thumb/X.png/<px>px-X.png
 * (même paramètre de cache). Renvoie l'URL telle quelle si ce n'est pas une image du wiki.
 */
export function wikiThumb(url: string, px: number): string {
  const m = WIKI_IMAGE_RE.exec(url)
  if (!m) return url
  const file = m[1]!
  return `https://seaofthieves.wiki.gg/images/thumb/${file}/${px}px-${file}${m[2] ?? ''}`
}
