// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Your custom configs here
  {
    rules: {
      // Vue 3 supporte plusieurs éléments racines (fragments) : règle Vue 2 inadaptée
      'vue/no-multiple-template-root': 'off'
    }
  }
)
