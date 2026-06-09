import { createAuth, type AuthEnv } from './auth'

export async function getSession(request: Request, env: AuthEnv) {
  const auth = createAuth(env)
  return auth.api.getSession({ headers: request.headers })
}

export function requireUserId(
  session: Awaited<ReturnType<typeof getSession>>,
): string | null {
  return session?.user?.id ?? null
}
