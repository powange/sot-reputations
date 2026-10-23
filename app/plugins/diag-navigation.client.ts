// DIAGNOSTIC TEMPORAIRE : la navigation vers /reputations reste bloquée sur « Chargement… »
// en production pour un compte connecté (non reproductible en dev). Trace chaque étape
// dans la console, préfixée [diag], pour voir où elle s'arrête. À retirer ensuite.
export default defineNuxtPlugin((nuxtApp) => {
  const t0 = () => `${Math.round(performance.now())}ms`
  const log = (...args: unknown[]) => console.info('[diag]', t0(), ...args)
  const router = useRouter()
  router.beforeEach((to, from) => {
    log('navigation', from.fullPath, '->', to.fullPath)
  })
  router.afterEach((to, _from, failure) => {
    log('navigation terminée', to.fullPath, failure ? `ÉCHEC ${String(failure)}` : '')
  })
  router.onError((err) => {
    log('ERREUR routeur', err)
  })
  nuxtApp.hook('page:start', () => log('page:start (chargement du composant de page)'))
  nuxtApp.hook('page:loading:start', () => log('page:loading:start'))
  nuxtApp.hook('page:loading:end', () => log('page:loading:end'))
  nuxtApp.hook('page:finish', () => log('page:finish (page affichée)'))
  nuxtApp.hook('app:error', err => log('ERREUR app', err))
  nuxtApp.hook('vue:error', (err, _instance, info) => log('ERREUR vue', info, err))
  window.addEventListener('unhandledrejection', e => log('PROMESSE REJETÉE', e.reason))
})
