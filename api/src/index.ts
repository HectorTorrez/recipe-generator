import { buildRecipePrompt } from './prompt'
import type { RecipeRequest, RecipeResponse } from './types'

const MODEL = '@cf/meta/llama-3.1-8b-instruct'

type Env = {
  AI: Ai
  ALLOWED_ORIGINS: string
}

function getCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((value) => value.trim())
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0]

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
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
      missingIngredients,
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
      missingIngredients: isStringArray(missingIngredients)
        ? missingIngredients
        : [],
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

  const ingredients = data.ingredients
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = getCorsHeaders(request, env)
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders })
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ status: 'ok', model: MODEL }, request, env)
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
