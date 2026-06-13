import { describe, expect, it } from 'vitest'
import { parseRecipeResponse } from './recipe-parser'

describe('parseRecipeResponse', () => {
  const validJson = JSON.stringify({
    recipes: [
      {
        name: 'Test Recipe',
        description: 'A quick test dish.',
        estimatedTimeMinutes: 20,
        ingredients: ['chicken', 'rice'],
        instructions: ['Cook chicken', 'Add rice'],
        whyRecommended: 'Uses available ingredients.',
        missingIngredients: ['olive oil'],
      },
    ],
  })

  it('parses valid JSON', () => {
    const result = parseRecipeResponse(validJson, 30)
    expect(result.recipes).toHaveLength(1)
    expect(result.recipes[0].name).toBe('Test Recipe')
    expect(result.recipes[0].missingIngredients).toEqual(['olive oil'])
  })

  it('strips markdown fences', () => {
    const fenced = '```json\n' + validJson + '\n```'
    const result = parseRecipeResponse(fenced, 30)
    expect(result.recipes[0].name).toBe('Test Recipe')
  })

  it('rejects recipes exceeding time limit', () => {
    const overTime = JSON.stringify({
      recipes: [
        {
          name: 'Slow Recipe',
          description: 'Too slow.',
          estimatedTimeMinutes: 60,
          ingredients: ['chicken'],
          instructions: ['Wait'],
          whyRecommended: 'Nope',
          missingIngredients: [],
        },
      ],
    })

    expect(() => parseRecipeResponse(overTime, 30)).toThrow('exceeds')
  })

  it('rejects invalid JSON', () => {
    expect(() => parseRecipeResponse('not json', 30)).toThrow('not valid JSON')
  })
})
