import { describe, expect, it } from 'vitest'
import { splitItemOcrLines } from '../app/utils/item-ocr'

const line = (text: string, size: number, confidence = 95) => ({ text, size, confidence })

describe('splitItemOcrLines', () => {
  it('sépare le titre (plus gros)  de la description et joint les lignes', () => {
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

  it('titre sur deux lignes (mesures de captures réelles)', () => {
    expect(splitItemOcrLines([
      line('Perruche de la malédiction', 27.3),
      line('dorée', 28.6),
      line('D\'accord, tu as gagné. Tu es une très belle', 17.1),
      line('perruche !', 18)
    ])).toEqual({ name: 'Perruche de la malédiction dorée', description: 'D\'accord, tu as gagné. Tu es une très belle perruche !' })
  })

  it('titre peu haut mais plus large (« Tromblon de l\'éclipse »)', () => {
    expect(splitItemOcrLines([
      line('Tromblon de l\'éclipse', 26.6),
      line('Plongez vos ennemis dans les ténèbres avec', 18.2),
      line('un tromblon cerclé d\'un cruel soleil de', 17.1),
      line('bronze.', 18.7)
    ]).name).toBe('Tromblon de l\'éclipse')
  })

  it('lignes de même taille : la première est le titre', () => {
    expect(splitItemOcrLines([line('Titre', 50), line('Texte', 50)])).toEqual({ name: 'Titre', description: 'Texte' })
    expect(splitItemOcrLines([line('Titre seul', 50)])).toEqual({ name: 'Titre seul', description: '' })
    expect(splitItemOcrLines([])).toEqual({ name: '', description: '' })
  })
})
