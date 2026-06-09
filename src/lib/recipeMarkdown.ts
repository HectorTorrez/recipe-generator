import type { Recipe } from '../types/recipe'

export function recipeToMarkdown(recipe: Recipe): string {
  const lines: string[] = [
    `# ${recipe.name}`,
    '',
    `**Estimated time:** ${recipe.estimatedTimeMinutes} min`,
    '',
    recipe.description,
    '',
    '## Why recommended',
    recipe.whyRecommended,
    '',
    '## Ingredients',
    ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
    '',
    '## Instructions',
    ...recipe.instructions.map((step, index) => `${index + 1}. ${step}`),
  ]

  return lines.join('\n')
}

export function recipesToMarkdown(recipes: Recipe[]): string {
  return recipes.map(recipeToMarkdown).join('\n\n---\n\n')
}
