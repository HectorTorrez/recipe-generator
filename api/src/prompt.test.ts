import { describe, expect, it } from 'vitest'
import { buildRecipePrompt, buildSubstitutionPrompt } from './prompt'

describe('buildRecipePrompt', () => {
  it('includes all constraints', () => {
    const prompt = buildRecipePrompt({
      ingredients: ['chicken', 'rice'],
      cookingTimeMinutes: 30,
      servings: 4,
      difficulty: 'beginner',
      dietaryPreferences: ['high-protein'],
      equipment: ['stove'],
      allergies: ['nuts'],
      cuisine: 'mexican',
      mealType: 'dinner',
    })

    expect(prompt).toContain('chicken, rice')
    expect(prompt).toContain('30 minutes')
    expect(prompt).toContain('Servings: 4')
    expect(prompt).toContain('beginner')
    expect(prompt).toContain('high-protein')
    expect(prompt).toContain('nuts')
    expect(prompt).toContain('Mexican')
    expect(prompt).toContain('dinner')
    expect(prompt).toContain('missingIngredients')
  })
})

describe('buildSubstitutionPrompt', () => {
  it('includes ingredient and pantry', () => {
    const prompt = buildSubstitutionPrompt('butter', ['olive oil', 'yogurt'])
    expect(prompt).toContain('butter')
    expect(prompt).toContain('olive oil, yogurt')
  })
})
