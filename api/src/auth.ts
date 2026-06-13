import { betterAuth } from 'better-auth'
import { bearer } from 'better-auth/plugins'

export type AuthEnv = {
  DB: D1Database
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  ALLOWED_ORIGINS: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

export function createAuth(env: AuthEnv) {
  const trustedOrigins = env.ALLOWED_ORIGINS.split(',').flatMap((value) => {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  })

  const socialProviders =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined

  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true,
    },
    socialProviders,
    trustedOrigins,
    plugins: [bearer()],
  })
}

export type Auth = ReturnType<typeof createAuth>
