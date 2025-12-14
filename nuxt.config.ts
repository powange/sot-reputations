// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui',
    '@nuxt/fonts',
    'nuxt-auth-utils'
  ],

  fonts: {
    families: [
      { name: 'DM Sans', provider: 'google' },
      { name: 'Pirata One', provider: 'google' }
    ]
  },

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  routeRules: {
    // SSR par défaut pour les pages dynamiques
  },

  compatibilityDate: '2025-01-15',

  runtimeConfig: {
    oauth: {
      microsoft: {
        clientId: '',
        clientSecret: '',
        tenant: 'consumers', // Pour les comptes Microsoft personnels (Xbox)
        scope: ['openid', 'profile', 'email', 'User.Read'],
        authorizationURL: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize',
        tokenURL: 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token'
      }
    },
    session: {
      maxAge: 60 * 60 * 24 * 7 // 7 jours
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  }
})
