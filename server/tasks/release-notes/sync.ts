import { syncReleaseNotes } from '../../utils/release-notes-sync'

export default defineTask({
  meta: {
    name: 'release-notes:sync',
    description: 'Synchronise les release notes (forum + dernière version) depuis seaofthieves.com'
  },
  async run() {
    const result = await syncReleaseNotes()
    console.log(
      `[release-notes:sync] ${result.totalFound} versions, ${result.added} ajoutées, `
      + `dernière: ${result.latestVersion ?? 'n/a'}, contenu récupéré: ${result.contentAdded}`
    )
    return { result }
  }
})
