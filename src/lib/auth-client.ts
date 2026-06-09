import { createAuthClient } from 'better-auth/react'
import {
  authHeaders,
  extractBearerToken,
  getAuthBaseURL,
  setBearerToken,
} from './auth-token'

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL(),
  fetchOptions: {
    auth: {
      type: 'Bearer',
      token: () => {
        if (typeof window === 'undefined') return ''
        return localStorage.getItem('recipe-generator-bearer-token') ?? ''
      },
    },
    onSuccess: (ctx) => {
      const token = extractBearerToken(ctx.response)
      if (token) setBearerToken(token)
    },
  },
})

export { authHeaders }
