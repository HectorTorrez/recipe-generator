import type { Difficulty, Recipe, RecipeRequest } from '../types/recipe'

type RecipeComparisonProps = {
  recipes: Recipe[]
  request: RecipeRequest
}

function ingredientOverlap(pantry: string[], recipeIngredients: string[]): number {
  if (pantry.length === 0) return 0
  const pantryLower = pantry.map((i) => i.toLowerCase())
  const matched = recipeIngredients.filter((ing) =>
    pantryLower.some(
      (p) => ing.toLowerCase().includes(p) || p.includes(ing.toLowerCase()),
    ),
  ).length
  return Math.round((matched / pantry.length) * 100)
}

function missingCount(recipe: Recipe): number {
  return recipe.missingIngredients?.length ?? 0
}

export function RecipeComparison({ recipes, request }: RecipeComparisonProps) {
  if (recipes.length < 2) return null

  const difficulty = request.difficulty ?? 'beginner'

  return (
    <details className="recipe-comparison">
      <summary className="recipe-comparison__toggle">Compare recipes</summary>
      <table className="recipe-comparison__table">
        <thead>
          <tr>
            <th scope="col">Recipe</th>
            <th scope="col">Time</th>
            <th scope="col">Missing</th>
            <th scope="col">Pantry overlap</th>
            <th scope="col">Difficulty</th>
          </tr>
        </thead>
        <tbody>
          {recipes.map((recipe) => (
            <tr key={recipe.name}>
              <td>{recipe.name}</td>
              <td>{recipe.estimatedTimeMinutes} min</td>
              <td>{missingCount(recipe)}</td>
              <td>{ingredientOverlap(request.ingredients, recipe.ingredients)}%</td>
              <td>{difficulty as Difficulty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
