import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync } from 'fs'

const username = process.argv[2]

if (!username) {
  console.error('Usage: npm run make-admin <username>')
  process.exit(1)
}

// Chercher la base de données dans plusieurs emplacements possibles
const possiblePaths = [
  join('/app/data', 'reputation.db'),           // Docker
  join(process.cwd(), 'data', 'reputation.db'), // Local ./data
  join(process.cwd(), 'reputation.db')          // Local racine
]

const dbPath = possiblePaths.find(p => existsSync(p))

if (!dbPath) {
  console.error('Base de donnees non trouvee. Chemins testes:')
  possiblePaths.forEach(p => console.error(`  - ${p}`))
  process.exit(1)
}

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
