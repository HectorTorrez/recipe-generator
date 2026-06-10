import { createAuth } from './auth'
import { buildRecipePrompt } from './prompt'
import {
  HistoryLimitReachedError,
  deleteHistoryEntry,
  listHistory,
  migrateGuestHistory,
  saveHistoryEntry,
} from './history'
import { recipesToMarkdown } from './recipeMarkdown'
import {
  RateLimitExceededError,
  enforceGenerationRateLimit,
} from './rate-limit'
import { getSession, requireUserId } from './session'
import type { GuestHistoryEntry } from './history'
import type { RecipeRequest, RecipeResponse } from './types'

const MODEL = '@cf/meta/llama-3.1-8b-instruct'

type Env = {
  AI: Ai
  DB: D1Database
  ALLOWED_ORIGINS: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
}

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'set-auth-token',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonResponse(
  body: unknown,
  request: Request,
  env: Env,
  status = 200,
): Response {
  return Response.json(body, {
    status,
    headers: getCorsHeaders(request, env),
  })
}

function markdownResponse(
  body: string,
  request: Request,
  env: Env,
  status = 200,
): Response {
  return new Response(body, {
    status,
    headers: {
      ...getCorsHeaders(request, env),
      'Content-Type': 'text/markdown; charset=utf-8',
    },
  })
}

function wantsMarkdownResponse(request: Request, url: URL): boolean {
  if (url.searchParams.get('format') === 'markdown') return true

  const accept = request.headers.get('Accept') ?? ''
  return accept.includes('text/markdown')
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim().length > 0)
  )
}

function parseRecipeResponse(
  raw: string,
  maxCookingTimeMinutes: number,
): RecipeResponse {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI response is not valid JSON')
  }

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !Array.isArray((parsed as RecipeResponse).recipes) ||
    (parsed as RecipeResponse).recipes.length === 0
  ) {
    throw new Error('AI response missing recipes array')
  }

  const timeToleranceMinutes = 5
  const recipes = (parsed as RecipeResponse).recipes.map((recipe, index) => {
    if (!recipe || typeof recipe !== 'object') {
      throw new Error(`Recipe ${index + 1} is not a valid object`)
    }

    const {
      name,
      description,
      estimatedTimeMinutes,
      ingredients,
      instructions,
      whyRecommended,
    } = recipe as Record<string, unknown>

    if (typeof name !== 'string' || !name.trim()) {
      throw new Error(`Recipe ${index + 1} is missing a valid name`)
    }

    if (typeof description !== 'string' || !description.trim()) {
      throw new Error(`Recipe ${index + 1} is missing a valid description`)
    }

    if (typeof whyRecommended !== 'string' || !whyRecommended.trim()) {
      throw new Error(`Recipe ${index + 1} is missing whyRecommended`)
    }

    if (!isStringArray(ingredients)) {
      throw new Error(`Recipe ${index + 1} is missing a valid ingredients list`)
    }

    if (!isStringArray(instructions)) {
      throw new Error(`Recipe ${index + 1} is missing valid instructions`)
    }

    const time =
      typeof estimatedTimeMinutes === 'number'
        ? estimatedTimeMinutes
        : Number(estimatedTimeMinutes)

    if (!Number.isFinite(time) || time <= 0) {
      throw new Error(`Recipe ${index + 1} has an invalid estimated time`)
    }

    if (time > maxCookingTimeMinutes + timeToleranceMinutes) {
      throw new Error(
        `Recipe ${index + 1} exceeds the ${maxCookingTimeMinutes}-minute time limit`,
      )
    }

    return {
      name: name.trim(),
      description: description.trim(),
      estimatedTimeMinutes: Math.round(time),
      ingredients,
      instructions,
      whyRecommended: whyRecommended.trim(),
    }
  })

  return { recipes }
}

function validateRequest(body: unknown): RecipeRequest | null {
  if (!body || typeof body !== 'object') return null

  const data = body as Record<string, unknown>

  if (!Array.isArray(data.ingredients) || data.ingredients.length === 0) {
    return null
  }

  if (
    typeof data.cookingTimeMinutes !== 'number' ||
    data.cookingTimeMinutes < 5
  ) {
    return null
  }

  const ingredients = data.ingredients.flatMap((item) => {
    const trimmed = typeof item === 'string' ? item.trim() : ''
    return trimmed ? [trimmed] : []
  })

  if (ingredients.length === 0) return null

  return {
    ingredients,
    cookingTimeMinutes: data.cookingTimeMinutes,
    difficulty:
      data.difficulty === 'beginner' ||
      data.difficulty === 'intermediate' ||
      data.difficulty === 'advanced'
        ? data.difficulty
        : undefined,
    dietaryPreferences: Array.isArray(data.dietaryPreferences)
      ? (data.dietaryPreferences as RecipeRequest['dietaryPreferences'])
      : undefined,
    equipment: Array.isArray(data.equipment)
      ? (data.equipment as RecipeRequest['equipment'])
      : undefined,
  }
}

function validateHistorySaveBody(body: unknown): {
  request: RecipeRequest
  recipes: RecipeResponse['recipes']
} | null {
  if (!body || typeof body !== 'object') return null

  const data = body as Record<string, unknown>
  const request = validateRequest(data.request)
  const recipes = data.recipes

  if (!request) return null
  if (!Array.isArray(recipes) || recipes.length === 0) return null

  const validRecipes = recipes.every(
    (recipe) =>
      recipe &&
      typeof recipe === 'object' &&
      typeof (recipe as { name?: unknown }).name === 'string',
  )

  if (!validRecipes) return null

  return {
    request,
    recipes: recipes as RecipeResponse['recipes'],
  }
}

function validateMigrateBody(body: unknown): GuestHistoryEntry[] | null {
  if (!body || typeof body !== 'object') return null

  const entries = (body as { entries?: unknown }).entries
  if (!Array.isArray(entries)) return null

  const validEntries: GuestHistoryEntry[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue

    const data = entry as Record<string, unknown>
    const request = validateRequest(data.request)
    const recipes = data.recipes

    if (
      typeof data.id !== 'string' ||
      typeof data.createdAt !== 'number' ||
      !request ||
      !Array.isArray(recipes) ||
      recipes.length === 0
    ) {
      continue
    }

    validEntries.push({
      id: data.id,
      createdAt: data.createdAt,
      request,
      recipes: recipes as RecipeResponse['recipes'],
    })
  }

  return validEntries
}

async function handleAuthRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = createAuth(env)
  const headers = new Headers(request.headers)
  const authRequest = new Request(request.url, {
    method: request.method,
    headers,
    body: request.body,
    redirect: request.redirect,
  })

  const response = await auth.handler(authRequest)
  const responseHeaders = new Headers(response.headers)
  const corsHeaders = getCorsHeaders(request, env)

  for (const [key, value] of Object.entries(corsHeaders)) {
    responseHeaders.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (url.pathname.startsWith('/api/auth')) {
      return handleAuthRequest(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ status: 'ok', model: MODEL }, request, env)
    }

    if (request.method === 'GET' && url.pathname === '/api/history') {
      const session = await getSession(request, env)
      const userId = requireUserId(session)

      if (!userId) {
        return jsonResponse({ error: 'Unauthorized' }, request, env, 401)
      }

      const entries = await listHistory(env.DB, userId)
      return jsonResponse({ entries }, request, env)
    }

    if (request.method === 'POST' && url.pathname === '/api/history') {
      const session = await getSession(request, env)
      const userId = requireUserId(session)

      if (!userId) {
        return jsonResponse({ error: 'Unauthorized' }, request, env, 401)
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, request, env, 400)
      }

      const payload = validateHistorySaveBody(body)
      if (!payload) {
        return jsonResponse({ error: 'Invalid history payload' }, request, env, 400)
      }

      try {
        const entry = await saveHistoryEntry(
          env.DB,
          userId,
          payload.request,
          payload.recipes,
        )

        return jsonResponse({ entry }, request, env, 201)
      } catch (err) {
        if (err instanceof HistoryLimitReachedError) {
          return jsonResponse(
            {
              error:
                'History limit reached. Delete an existing entry before saving a new one.',
            },
            request,
            env,
            409,
          )
        }

        throw err
      }
    }

    const historyDeleteMatch = url.pathname.match(/^\/api\/history\/([^/]+)$/)
    if (request.method === 'DELETE' && historyDeleteMatch) {
      const session = await getSession(request, env)
      const userId = requireUserId(session)

      if (!userId) {
        return jsonResponse({ error: 'Unauthorized' }, request, env, 401)
      }

      const deleted = await deleteHistoryEntry(
        env.DB,
        userId,
        historyDeleteMatch[1],
      )

      if (!deleted) {
        return jsonResponse({ error: 'History entry not found' }, request, env, 404)
      }

      return jsonResponse({ ok: true }, request, env)
    }

    if (request.method === 'POST' && url.pathname === '/api/history/migrate') {
      const session = await getSession(request, env)
      const userId = requireUserId(session)

      if (!userId) {
        return jsonResponse({ error: 'Unauthorized' }, request, env, 401)
      }

      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, request, env, 400)
      }

      const entries = validateMigrateBody(body)
      if (!entries) {
        return jsonResponse({ error: 'Invalid migrate payload' }, request, env, 400)
      }

      const result = await migrateGuestHistory(env.DB, userId, entries)
      return jsonResponse(result, request, env)
    }

    if (request.method === 'POST' && url.pathname === '/api/recipes') {
      let body: unknown

      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, request, env, 400)
      }

      const recipeRequest = validateRequest(body)

      if (!recipeRequest) {
        return jsonResponse(
          {
            error:
              'Request must include at least one ingredient and cookingTimeMinutes >= 5',
          },
          request,
          env,
          400,
        )
      }

      const session = await getSession(request, env)
      const userId = requireUserId(session)

      try {
        await enforceGenerationRateLimit(env.DB, request, userId)
      } catch (err) {
        if (err instanceof RateLimitExceededError) {
          return Response.json(
            {
              error: err.message,
              code: 'RATE_LIMIT_EXCEEDED',
              retryAfterSeconds: err.retryAfterSeconds,
            },
            {
              status: 429,
              headers: {
                ...getCorsHeaders(request, env),
                'Retry-After': String(err.retryAfterSeconds),
              },
            },
          )
        }

        throw err
      }

      try {
        const prompt = buildRecipePrompt(recipeRequest)

        const aiResult = await env.AI.run(MODEL, {
          messages: [
            {
              role: 'system',
              content:
                'You are a culinary expert. Always respond with valid JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          max_tokens: 2048,
          temperature: 0.7,
        })

        const text =
          typeof aiResult === 'string'
            ? aiResult
            : ((aiResult as { response?: string }).response ?? '')

        if (!text) {
          throw new Error('Empty AI response')
        }

        const recipes = parseRecipeResponse(
          text,
          recipeRequest.cookingTimeMinutes,
        )

        if (wantsMarkdownResponse(request, url)) {
          return markdownResponse(
            recipesToMarkdown(recipes.recipes),
            request,
            env,
          )
        }

        return jsonResponse(recipes, request, env)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Recipe generation failed'

        return jsonResponse({ error: message }, request, env, 500)
      }
    }

    return jsonResponse({ error: 'Not found' }, request, env, 404)
  },
} satisfies ExportedHandler<Env>
