import { betterAuth } from 'better-auth'
import { bearer } from 'better-auth/plugins'

export type AuthEnv = {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  ALLOWED_ORIGINS: string
}

export function createAuth(env: AuthEnv) {
  const trustedOrigins = env.ALLOWED_ORIGINS.split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins,
    plugins: [bearer()],
  })
}

export type Auth = ReturnType<typeof createAuth>
