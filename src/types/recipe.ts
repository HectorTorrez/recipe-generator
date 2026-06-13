export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

export type DietaryPreference =
  | 'vegetarian'
  | 'vegan'
  | 'gluten-free'
  | 'low-carb'
  | 'high-protein'

export type Equipment = 'stove' | 'oven' | 'air-fryer' | 'microwave'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type Cuisine =
  | 'italian'
  | 'mexican'
  | 'asian'
  | 'mediterranean'
  | 'american'

export type RecipeRequest = {
  ingredients: string[]
  cookingTimeMinutes: number
  servings?: number
  difficulty?: Difficulty
  dietaryPreferences?: DietaryPreference[]
  equipment?: Equipment[]
  allergies?: string[]
  cuisine?: Cuisine
  mealType?: MealType
}

export type Recipe = {
  name: string
  description: string
  estimatedTimeMinutes: number
  ingredients: string[]
  instructions: string[]
  whyRecommended: string
  missingIngredients?: string[]
}

export type RecipeResponse = {
  recipes: Recipe[]
}

export type UserPreferences = {
  ingredients: string[]
  cookingTimeMinutes: number
  servings: number
  difficulty: Difficulty
  dietaryPreferences: DietaryPreference[]
  equipment: Equipment[]
  allergies: string[]
  cuisine?: Cuisine
  mealType?: MealType
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

export type FavoriteEntry = {
  id: string
  createdAt: number
  recipe: Recipe
  request: RecipeRequest
}

export type ShoppingListItem = {
  id: string
  name: string
  checked: boolean
}

export type QuotaInfo = {
  used: number
  limit: number
  resetsAt: number
  bucket: 'guest' | 'user'
}

export type SharedGeneration = {
  id: string
  createdAt: number
  request: RecipeRequest
  recipes: Recipe[]
}
