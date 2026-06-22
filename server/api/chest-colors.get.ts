import { CHEST_COLOR_PALETTE } from '../utils/chest-colors'

/**
 * GET /api/chest-colors
 * Palette de couleurs nommées (nom + pastille hex) pour le filtre couleur.
 */
export default defineEventHandler(() => {
  return CHEST_COLOR_PALETTE
})
