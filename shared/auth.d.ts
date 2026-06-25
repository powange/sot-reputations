// Augmentation du type `User` de nuxt-auth-utils avec la forme réellement
// stockée en session — voir setUserSession dans :
//   - server/routes/auth/microsoft.get.ts
//   - server/api/auth/login.post.ts
// Placé dans shared/ car les tsconfig app ET server incluent `shared/**/*.d.ts`.
declare module '#auth-utils' {
  interface User {
    id: number
    username: string
    microsoftId?: string
    isAdmin: boolean
  }
}

export {}
