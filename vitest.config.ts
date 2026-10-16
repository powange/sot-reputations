import { defineConfig } from 'vitest/config'

// Tests unitaires des fonctions pures (shared/, app/utils) : pas besoin de l'environnement Nuxt
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts']
  }
})
