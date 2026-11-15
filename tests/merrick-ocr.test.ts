import { beforeAll, describe, expect, it } from 'vitest'
import fr from '../i18n/locales/fr.json'
import * as fishing from '../shared/utils/fishing'

// Imports automatiques de Nuxt utilisés par merrick-ocr, fournis à la main hors Nuxt.
Object.assign(globalThis, fishing)
let ocr: typeof import('../app/utils/merrick-ocr')
beforeAll(async () => {
  ocr = await import('../app/utils/merrick-ocr')
})

const meats = (lines: string[]) => {
  const vocab = ocr.buildMerrickVocabulary([fr], [true])
  return ocr.parseMerrickMenu(lines, vocab).flatMap(d => d.ingredients).filter(i => i.type === 'meat').map(i => i.key)
}

describe('lecture du menu de Merrick', () => {
  it('reconnaît « cochon » (porc sur le site) et « poulet » (poule sur le site)', () => {
    const found = meats(['Menu de Merrick', 'Entrée', 'Ragoût', '2 Cochon cuit', '1 Poulet cuit'])
    expect(found).toContain('pork')
    expect(found).toContain('chicken')
  })
})
