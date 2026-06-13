import { createAuth } from './auth'
import {
  deleteFavorite,
  listFavorites,
  migrateGuestFavorites,
  saveFavorite,
} from './favorites'
import {
  HistoryLimitReachedError,
  deleteHistoryEntry,
  listHistory,
  migrateGuestHistory,
  saveHistoryEntry,
} from './history'
import {
  buildRecipePrompt,
  buildSingleRecipePrompt,
  buildSubstitutionPrompt,
  buildVisionPrompt,
} from './prompt'
import { getUserPreferences, saveUserPreferences } from './preferences'
import {
  parseRecipeResponse,
  parseSubstitutionResponse,
  parseVisionResponse,
} from './recipe-parser'
import { recipesToMarkdown } from './recipeMarkdown'
import {
  RateLimitExceededError,
  enforceGenerationRateLimit,
  enforceImageRateLimit,
  getQuota,
} from './rate-limit'
import { createShareLink, getSharedGeneration } from './share'
import { getSession, requireUserId } from './session'
import { validateRequest } from './validate'
import type { GuestHistoryEntry } from './history'
import type { FavoriteEntry, Recipe, RecipeRequest, RecipeResponse } from './types'

const MODEL = '@cf/meta/llama-3.1-8b-instruct'
const VISION_MODEL = '@cf/llava-hf/llava-1.5-7b-hf'

type Env = {
  AI: Ai
  DB: D1Database
  ALLOWED_ORIGINS: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

function logEvent(
  event: string,
  data: Record<string, unknown>,
): void {
  console.log(JSON.stringify({ event, ...data, ts: Date.now() }))
}

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
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
  return { request, recipes: recipes as RecipeResponse['recipes'] }
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

function validateFavoritesMigrateBody(body: unknown): FavoriteEntry[] | null {
  if (!body || typeof body !== 'object') return null
  const entries = (body as { entries?: unknown }).entries
  if (!Array.isArray(entries)) return null
  const valid: FavoriteEntry[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const data = entry as Record<string, unknown>
    const request = validateRequest(data.request)
    const recipe = data.recipe
    if (
      typeof data.id !== 'string' ||
      typeof data.createdAt !== 'number' ||
      !request ||
      !recipe ||
      typeof recipe !== 'object'
    ) {
      continue
    }
    valid.push({
      id: data.id,
      createdAt: data.createdAt,
      request,
      recipe: recipe as Recipe,
    })
  }
  return valid
}

async function runAi(
  env: Env,
  prompt: string,
  maxTokens = 2048,
): Promise<string> {
  const aiResult = await env.AI.run(MODEL, {
    messages: [
      {
        role: 'system',
        content: 'You are a culinary expert. Always respond with valid JSON only.',
      },
      { role: 'user', content: prompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  })

  const text =
    typeof aiResult === 'string'
      ? aiResult
      : ((aiResult as { response?: string }).response ?? '')

  if (!text) throw new Error('Empty AI response')
  return text
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

    if (request.method === 'GET' && url.pathname === '/api/quota') {
      const session = await getSession(request, env)
      const userId = requireUserId(session)
      const quota = await getQuota(env.DB, request, userId)
      return jsonResponse(quota, request, env)
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

    const historyShareMatch = url.pathname.match(
      /^\/api\/history\/([^/]+)\/share$/,
    )
    if (request.method === 'POST' && historyShareMatch) {
      const session = await getSession(request, env)
      const userId = requireUserId(session)
      if (!userId) {
        return jsonResponse({ error: 'Unauthorized' }, request, env, 401)
      }
      const entries = await listHistory(env.DB, userId)
      const entry = entries.find((e) => e.id === historyShareMatch[1])
      if (!entry) {
        return jsonResponse({ error: 'History entry not found' }, request, env, 404)
      }
      const { shareId, expiresAt } = await createShareLink(
        env.DB,
        userId,
        entry,
      )
      return jsonResponse({ shareId, expiresAt }, request, env, 201)
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

    if (request.method === 'GET' && url.pathname === '/api/favorites') {
      const session = await getSession(request, env)
      const userId = requireUserId(session)
      if (!userId) {
        return jsonResponse({ error: 'Unauthorized' }, request, env, 401)
      }
      const entries = await listFavorites(env.DB, userId)
      return jsonResponse({ entries }, request, env)
    }

    if (request.method === 'POST' && url.pathname === '/api/favorites') {
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
      const data = body as { recipe?: Recipe; request?: unknown }
      const requestData = validateRequest(data.request)
      if (!requestData || !data.recipe || typeof data.recipe !== 'object') {
        return jsonResponse({ error: 'Invalid favorite payload' }, request, env, 400)
      }
      const entry = await saveFavorite(
        env.DB,
        userId,
        data.recipe,
        requestData,
      )
      return jsonResponse({ entry }, request, env, 201)
    }

    const favoriteDeleteMatch = url.pathname.match(/^\/api\/favorites\/([^/]+)$/)
    if (request.method === 'DELETE' && favoriteDeleteMatch) {
      const session = await getSession(request, env)
      const userId = requireUserId(session)
      if (!userId) {
        return jsonResponse({ error: 'Unauthorized' }, request, env, 401)
      }
      const deleted = await deleteFavorite(
        env.DB,
        userId,
        favoriteDeleteMatch[1],
      )
      if (!deleted) {
        return jsonResponse({ error: 'Favorite not found' }, request, env, 404)
      }
      return jsonResponse({ ok: true }, request, env)
    }

    if (request.method === 'POST' && url.pathname === '/api/favorites/migrate') {
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
      const entries = validateFavoritesMigrateBody(body)
      if (!entries) {
        return jsonResponse({ error: 'Invalid migrate payload' }, request, env, 400)
      }
      const result = await migrateGuestFavorites(env.DB, userId, entries)
      return jsonResponse(result, request, env)
    }

    if (request.method === 'GET' && url.pathname === '/api/preferences') {
      const session = await getSession(request, env)
      const userId = requireUserId(session)
      if (!userId) {
        return jsonResponse({ error: 'Unauthorized' }, request, env, 401)
      }
      const prefs = await getUserPreferences(env.DB, userId)
      return jsonResponse(prefs ?? { preferences: null, updatedAt: 0 }, request, env)
    }

    if (request.method === 'PUT' && url.pathname === '/api/preferences') {
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
      const preferences = (body as { preferences?: unknown }).preferences
      if (!preferences || typeof preferences !== 'object') {
        return jsonResponse({ error: 'Invalid preferences' }, request, env, 400)
      }
      const result = await saveUserPreferences(env.DB, userId, preferences)
      return jsonResponse(result, request, env)
    }

    const shareMatch = url.pathname.match(/^\/api\/share\/([^/]+)$/)
    if (request.method === 'GET' && shareMatch) {
      const entry = await getSharedGeneration(env.DB, shareMatch[1])
      if (!entry) {
        return jsonResponse({ error: 'Share not found or expired' }, request, env, 404)
      }
      return jsonResponse({ entry }, request, env)
    }

    if (request.method === 'POST' && url.pathname === '/api/recipes/single') {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, request, env, 400)
      }
      const data = body as {
        request?: unknown
        action?: string
        recipe?: Recipe
        refinement?: string
      }
      const recipeRequest = validateRequest(data.request)
      if (!recipeRequest) {
        return jsonResponse({ error: 'Invalid request' }, request, env, 400)
      }
      if (data.action !== 'regenerate' && data.action !== 'refine') {
        return jsonResponse({ error: 'Invalid action' }, request, env, 400)
      }

      const session = await getSession(request, env)
      const userId = requireUserId(session)
      const start = Date.now()

      try {
        await enforceGenerationRateLimit(env.DB, request, userId)
      } catch (err) {
        if (err instanceof RateLimitExceededError) {
          logEvent('rate_limit', { userId, path: '/api/recipes/single' })
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
        const prompt = buildSingleRecipePrompt(
          recipeRequest,
          data.action,
          data.recipe,
          data.refinement,
        )
        const text = await runAi(env, prompt, 1024)
        const recipes = parseRecipeResponse(text, recipeRequest.cookingTimeMinutes)
        logEvent('recipe_single_success', {
          userId,
          durationMs: Date.now() - start,
          model: MODEL,
        })
        return jsonResponse({ recipe: recipes.recipes[0] }, request, env)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Recipe generation failed'
        logEvent('recipe_single_error', {
          userId,
          durationMs: Date.now() - start,
          error: message,
        })
        return jsonResponse({ error: message }, request, env, 500)
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/recipes/substitute') {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, request, env, 400)
      }
      const data = body as { ingredient?: string; pantry?: string[] }
      if (
        typeof data.ingredient !== 'string' ||
        !Array.isArray(data.pantry) ||
        data.pantry.length === 0
      ) {
        return jsonResponse({ error: 'Invalid substitute request' }, request, env, 400)
      }

      const session = await getSession(request, env)
      const userId = requireUserId(session)
      const start = Date.now()

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
        const prompt = buildSubstitutionPrompt(data.ingredient, data.pantry)
        const text = await runAi(env, prompt, 256)
        const substitution = parseSubstitutionResponse(text)
        logEvent('substitution_success', {
          userId,
          durationMs: Date.now() - start,
        })
        return jsonResponse({ substitution }, request, env)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Substitution failed'
        return jsonResponse({ error: message }, request, env, 500)
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/recipes/stream') {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, request, env, 400)
      }
      const recipeRequest = validateRequest(body)
      if (!recipeRequest) {
        return jsonResponse({ error: 'Invalid request' }, request, env, 400)
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

      const start = Date.now()
      const prompt = buildRecipePrompt(recipeRequest)

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder()
          try {
            const text = await runAi(env, prompt)
            const recipes = parseRecipeResponse(
              text,
              recipeRequest.cookingTimeMinutes,
            )
            for (const recipe of recipes.recipes) {
              controller.enqueue(
                encoder.encode(
                  JSON.stringify({ type: 'recipe', recipe }) + '\n',
                ),
              )
            }
            controller.enqueue(
              encoder.encode(JSON.stringify({ type: 'done' }) + '\n'),
            )
            logEvent('recipe_stream_success', {
              userId,
              durationMs: Date.now() - start,
              model: MODEL,
            })
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Stream failed'
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: 'error', error: message }) + '\n',
              ),
            )
            logEvent('recipe_stream_error', {
              userId,
              durationMs: Date.now() - start,
              error: message,
            })
          } finally {
            controller.close()
          }
        },
      })

      return new Response(stream, {
        headers: {
          ...getCorsHeaders(request, env),
          'Content-Type': 'application/x-ndjson',
        },
      })
    }

    if (request.method === 'POST' && url.pathname === '/api/ingredients/from-image') {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return jsonResponse({ error: 'Invalid JSON body' }, request, env, 400)
      }
      const image = (body as { image?: string }).image
      if (typeof image !== 'string' || image.length === 0) {
        return jsonResponse({ error: 'Image required' }, request, env, 400)
      }

      try {
        await enforceImageRateLimit(env.DB, request)
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

      const start = Date.now()
      try {
        const aiResult = await env.AI.run(VISION_MODEL, {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: buildVisionPrompt() },
                { type: 'image', image: image.replace(/^data:image\/\w+;base64,/, '') },
              ],
            },
          ],
          max_tokens: 512,
        })

        const text =
          typeof aiResult === 'string'
            ? aiResult
            : ((aiResult as { response?: string }).response ?? '')

        const ingredients = parseVisionResponse(text)
        logEvent('vision_success', {
          durationMs: Date.now() - start,
          count: ingredients.length,
        })
        return jsonResponse({ ingredients }, request, env)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Image analysis failed'
        logEvent('vision_error', { durationMs: Date.now() - start, error: message })
        return jsonResponse({ error: message }, request, env, 500)
      }
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
      const start = Date.now()

      try {
        await enforceGenerationRateLimit(env.DB, request, userId)
      } catch (err) {
        if (err instanceof RateLimitExceededError) {
          logEvent('rate_limit', { userId, path: '/api/recipes' })
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
        const text = await runAi(env, prompt)
        const recipes = parseRecipeResponse(
          text,
          recipeRequest.cookingTimeMinutes,
        )

        logEvent('recipe_success', {
          userId,
          durationMs: Date.now() - start,
          model: MODEL,
          count: recipes.recipes.length,
        })

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
        logEvent('recipe_error', {
          userId,
          durationMs: Date.now() - start,
          error: message,
        })
        return jsonResponse({ error: message }, request, env, 500)
      }
    }

    return jsonResponse({ error: 'Not found' }, request, env, 404)
  },
} satisfies ExportedHandler<Env>
