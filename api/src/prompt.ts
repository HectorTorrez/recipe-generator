import type { RecipeRequest } from './types'

export function buildRecipePrompt(request: RecipeRequest): string {
  const {
    ingredients,
    cookingTimeMinutes,
    difficulty,
    dietaryPreferences = [],
    equipment = [],
  } = request

  const constraints = [
    `Available ingredients: ${ingredients.join(', ')}`,
    `Maximum total cooking time: ${cookingTimeMinutes} minutes`,
    difficulty ? `Cooking skill level: ${difficulty}` : null,
    dietaryPreferences.length > 0
      ? `Dietary preferences: ${dietaryPreferences.join(', ')}`
      : null,
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
- List any extra ingredients not provided by the user in missingIngredients.
- Adapt complexity to the skill level when specified.
- Respect all dietary preferences strictly.
- Only suggest recipes that can be made with the listed equipment when equipment is specified.

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
