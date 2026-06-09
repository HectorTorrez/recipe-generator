const BEARER_TOKEN_KEY = 'recipe-generator-bearer-token'

const configuredApiBase =
  import.meta.env.VITE_API_URL?.replace(/\/$/, '') ?? ''

/** Absolute API origin. Better Auth requires a full URL, not a path. */
export function getApiBase(): string {
  if (configuredApiBase) return configuredApiBase
  if (typeof window !== 'undefined') return window.location.origin
  return 'http://localhost:3000'
}

export function getAuthBaseURL(): string {
  return `${getApiBase()}/api/auth`
}

export function getBearerToken(): string {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(BEARER_TOKEN_KEY) ?? ''
}

export function setBearerToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(BEARER_TOKEN_KEY, token)
}

export function clearBearerToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(BEARER_TOKEN_KEY)
}

export function extractBearerToken(response: Response): string | null {
  const authToken = response.headers.get('set-auth-token')
  if (authToken) return authToken

  const bearerToken = response.headers.get('set-auth-bearer')
  if (bearerToken) return bearerToken

  return null
}

export function authHeaders(): HeadersInit {
  const token = getBearerToken()
  if (!token) return {}

  return {
    Authorization: `Bearer ${token}`,
  }
}
