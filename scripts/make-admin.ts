import Database from 'better-sqlite3'
import { join } from 'path'

const username = process.argv[2]

if (!username) {
  console.error('Usage: npx tsx scripts/make-admin.ts <username>')
  process.exit(1)
}

const dbPath = join('/app/data', 'reputation.db')

try {
  const db = new Database(dbPath)

  const user = db.prepare('SELECT id, username, is_admin FROM users WHERE username = ?').get(username) as { id: number; username: string; is_admin: number } | undefined

  if (!user) {
    console.error(`Utilisateur "${username}" non trouve.`)
    process.exit(1)
  }

  if (user.is_admin === 1) {
    console.log(`${username} est deja administrateur.`)
    process.exit(0)
  }

  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id)
  console.log(`${username} est maintenant administrateur.`)

  db.close()
} catch (error) {
  console.error('Erreur:', error)
  process.exit(1)
}
