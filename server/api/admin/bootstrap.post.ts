import { timingSafeEqual } from 'crypto'
import { getReputationDb, setUserAdmin } from '../../utils/reputation-db'

// Comparaison à temps constant (évite les attaques temporelles sur le token)
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export default defineEventHandler(async (event) => {
  // Le bootstrap n'est possible que si un secret est configuré ET fourni.
  // Sans ça, n'importe qui pourrait s'auto-promouvoir admin tant qu'aucun admin n'existe.
  const bootstrapToken = process.env.BOOTSTRAP_TOKEN
  if (!bootstrapToken) {
    throw createError({
      statusCode: 403,
      message: 'Bootstrap desactive (BOOTSTRAP_TOKEN non configure).'
    })
  }

  const db = getReputationDb()

  // Vérifier s'il existe déjà un admin
  const existingAdmin = db.prepare('SELECT id FROM users WHERE is_admin = 1 LIMIT 1').get()
  if (existingAdmin) {
    throw createError({
      statusCode: 403,
      message: 'Un administrateur existe deja. Utilisez l\'interface admin pour gerer les administrateurs.'
    })
  }

  const body = await readBody(event)
  const { username, token } = body

  if (!token || typeof token !== 'string' || !safeEqual(token, bootstrapToken)) {
    throw createError({
      statusCode: 403,
      message: 'Token de bootstrap invalide'
    })
  }

  if (!username || typeof username !== 'string') {
    throw createError({
      statusCode: 400,
      message: 'Username requis'
    })
  }

  // Trouver l'utilisateur
  const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(username) as { id: number, username: string } | undefined

  if (!user) {
    throw createError({
      statusCode: 404,
      message: `Utilisateur "${username}" non trouve`
    })
  }

  // Promouvoir en admin
  setUserAdmin(user.id, true)

  return {
    success: true,
    message: `${user.username} est maintenant administrateur`
  }
})
