import { describe, expect, it } from 'vitest'
import { splitItemOcrLines } from '../app/utils/item-ocr'

const line = (text: string, height: number, confidence = 95) => ({ text, height, confidence })

describe('splitItemOcrLines', () => {
  it('sépare le titre (plus grand) de la description et joint les lignes', () => {
    expect(splitItemOcrLines([
      line('Chat sauvage saphir', 85),
      line('Un peu farouches et galeux, mais fidèles à', 47),
      line('ceux qui les nourrissent, les pirates et les', 47),
      line('chats sauvages sont faits pour s\'entendre.', 47)
    ])).toEqual({
      name: 'Chat sauvage saphir',
      description: 'Un peu farouches et galeux, mais fidèles à ceux qui les nourrissent, les pirates et les chats sauvages sont faits pour s\'entendre.'
    })
  })

  it('titre sur deux lignes, bruit au-dessus ignoré', () => {
    expect(splitItemOcrLines([
      line('x', 20),
      line('Légende', 30, 20),
      line('Canons du', 80),
      line('Grand Large', 82),
      line('Une description.', 45)
    ])).toEqual({ name: 'Canons du Grand Large', description: 'Une description.' })
  })

  it('lignes de même taille : la première est le titre', () => {
    expect(splitItemOcrLines([line('Titre', 50), line('Texte', 50)])).toEqual({ name: 'Titre', description: 'Texte' })
    expect(splitItemOcrLines([line('Titre seul', 50)])).toEqual({ name: 'Titre seul', description: '' })
    expect(splitItemOcrLines([])).toEqual({ name: '', description: '' })
  })
})
