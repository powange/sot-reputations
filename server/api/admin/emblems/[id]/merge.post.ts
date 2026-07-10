import { requireAdminOrModerator } from '../../../../utils/admin'
import { getReputationDb, mergeEmblem } from '../../../../utils/reputation-db'

/**
 * POST /api/admin/emblems/:id/merge   body: { targetId }
 * Fusionne l'emblème :id (doublon, source) dans l'emblème cible : migre les
 * progressions joueurs de la source vers la cible (meilleure progression
 * conservée en cas de conflit), puis supprime la source. Sert à nettoyer les
 * doublons créés par certains imports.
 */
export default defineEventHandler(async (event) => {
  await requireAdminOrModerator(event)

  const sourceId = Number(getRouterParam(event, 'id'))
  const body = await readBody<{ targetId?: number }>(event)
  const targetId = Number(body?.targetId)

  if (!sourceId || isNaN(sourceId) || !targetId || isNaN(targetId)) {
    throw createError({ statusCode: 400, message: 'IDs invalides' })
  }
  if (sourceId === targetId) {
    throw createError({ statusCode: 400, message: 'La source et la cible doivent être différentes' })
  }

  const db = getReputationDb()
  const source = db.prepare('SELECT id, name FROM emblems WHERE id = ?').get(sourceId) as { id: number, name: string } | undefined
  const target = db.prepare('SELECT id, name FROM emblems WHERE id = ?').get(targetId) as { id: number, name: string } | undefined
  if (!source) {
    throw createError({ statusCode: 404, message: 'Emblème source non trouvé' })
  }
  if (!target) {
    throw createError({ statusCode: 404, message: 'Emblème cible non trouvé' })
  }

  const { migrated, merged } = mergeEmblem(sourceId, targetId)

  return {
    success: true,
    migrated,
    merged,
    message: `« ${source.name} » fusionné dans « ${target.name} » — ${migrated} joueur(s) migré(s)`
      + (merged > 0 ? `, ${merged} déjà présent(s) (progression fusionnée)` : '')
  }
})
