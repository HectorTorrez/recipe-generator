import { describe, expect, it } from 'vitest'
import { recipeToMarkdown } from './recipeMarkdown'
import type { Recipe } from '../types/recipe'

describe('recipeToMarkdown', () => {
  it('includes missing ingredients section', () => {
    const recipe: Recipe = {
      name: 'Garlic Rice',
      description: 'Simple rice dish.',
      estimatedTimeMinutes: 15,
      ingredients: ['rice', 'garlic'],
      instructions: ['Cook rice'],
      whyRecommended: 'Quick and easy.',
      missingIngredients: ['olive oil'],
    }

    const md = recipeToMarkdown(recipe)
    expect(md).toContain('# Garlic Rice')
    expect(md).toContain('## You will need')
    expect(md).toContain('- olive oil')
  })
})
