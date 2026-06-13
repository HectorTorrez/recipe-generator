import type { RecipeRequest } from './types'

const CUISINE_LABELS: Record<string, string> = {
  italian: 'Italian',
  mexican: 'Mexican',
  asian: 'Asian',
  mediterranean: 'Mediterranean',
  american: 'American',
}

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snack',
}

export function buildRecipePrompt(request: RecipeRequest): string {
  const {
    ingredients,
    cookingTimeMinutes,
    servings = 2,
    difficulty,
    dietaryPreferences = [],
    equipment = [],
    allergies = [],
    cuisine,
    mealType,
  } = request

  const constraints = [
    `Available ingredients: ${ingredients.join(', ')}`,
    `Maximum total cooking time: ${cookingTimeMinutes} minutes`,
    `Servings: ${servings}`,
    difficulty ? `Cooking skill level: ${difficulty}` : null,
    dietaryPreferences.length > 0
      ? `Dietary preferences: ${dietaryPreferences.join(', ')}`
      : null,
    allergies.length > 0
      ? `Allergies to avoid: ${allergies.join(', ')}`
      : null,
    cuisine ? `Cuisine style: ${CUISINE_LABELS[cuisine] ?? cuisine}` : null,
    mealType ? `Meal type: ${MEAL_LABELS[mealType] ?? mealType}` : null,
    equipment.length > 0
      ? `Available equipment: ${equipment.join(', ')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  return `You are a helpful chef assistant. Generate exactly 3 recipe recommendations based on the user's constraints.

${constraints}

Rules:
- Prioritize recipes that use as many provided ingredients as possible.
- Every recipe MUST be completable within ${cookingTimeMinutes} minutes total (prep + cook).
- Scale all ingredient quantities for ${servings} servings.
- Adapt complexity to the skill level when specified.
- Respect all dietary preferences and allergies strictly.
- Only suggest recipes that can be made with the listed equipment when equipment is specified.
- For each recipe, list missingIngredients: ingredients needed that are NOT in the user's available ingredients list (empty array if none).

Respond with ONLY valid JSON matching this schema (no markdown, no extra text):
{
  "recipes": [
    {
      "name": "string",
      "description": "string (1-2 sentences)",
      "estimatedTimeMinutes": number,
      "ingredients": ["string"],
      "instructions": ["string (step-by-step)"],
      "whyRecommended": "string (explain ingredient usage and time fit)",
      "missingIngredients": ["string"]
    }
  ]
}`
}

export function buildSingleRecipePrompt(
  request: RecipeRequest,
  action: 'regenerate' | 'refine',
  recipe?: { name: string; description: string; ingredients: string[]; instructions: string[] },
  refinement?: string,
): string {
  const base = buildRecipePrompt({ ...request, ingredients: request.ingredients })

  if (action === 'regenerate') {
    return `${base}

Generate exactly 1 NEW recipe variation (different from any previous). Return JSON with a single recipe in the recipes array.`
  }

  return `${base}

Refine this existing recipe based on the user's request.
${recipe ? `Current recipe: ${JSON.stringify(recipe)}` : ''}
Refinement request: ${refinement ?? 'Improve the recipe'}

Return JSON with exactly 1 refined recipe in the recipes array.`
}

export function buildSubstitutionPrompt(
  ingredient: string,
  pantry: string[],
): string {
  return `You are a culinary expert. Suggest ONE substitute for "${ingredient}" using only these pantry items: ${pantry.join(', ')}.

Respond with ONLY valid JSON:
{ "substitution": "string (one sentence explaining the swap)" }`
}

export function buildVisionPrompt(): string {
  return `List all food ingredients visible in this image. Return ONLY valid JSON:
{ "ingredients": ["string"] }

Use simple ingredient names (e.g. "tomato", "chicken breast"). Do not include non-food items.`
}
