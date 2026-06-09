export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type DietaryPreference =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'low-carb'
  | 'high-protein'

export type Equipment = 'stove' | 'oven' | 'air-fryer' | 'microwave'

export type RecipeRequest = {
  ingredients: string[]
  cookingTimeMinutes: number
  difficulty?: Difficulty
  dietaryPreferences?: DietaryPreference[]
  equipment?: Equipment[]
}

export type Recipe = {
  name: string
  description: string
  estimatedTimeMinutes: number
  ingredients: string[]
  instructions: string[]
  whyRecommended: string
}

export type RecipeResponse = {
  recipes: Recipe[]
}

export type HistoryEntry = {
  id: string
  createdAt: number
  request: RecipeRequest
  recipes: Recipe[]
}

export type GuestHistoryEntry = {
  id: string
  createdAt: number
  request: RecipeRequest
  recipes: Recipe[]
}
