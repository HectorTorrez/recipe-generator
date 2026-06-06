import type { Recipe } from '../types/recipe'

type RecipeCardProps = {
  recipe: Recipe
  index: number
}

export function RecipeCard({ recipe, index }: RecipeCardProps) {
  return (
    <article className="recipe-card">
      <header className="recipe-card__header">
        <span className="recipe-card__badge">#{index + 1}</span>
        <div>
          <h3 className="recipe-card__title">{recipe.name}</h3>
          <p className="recipe-card__time">
            {recipe.estimatedTimeMinutes} min estimated
          </p>
        </div>
      </header>

      <p className="recipe-card__description">{recipe.description}</p>

      <div className="recipe-card__section">
        <h4>Why recommended</h4>
        <p>{recipe.whyRecommended}</p>
      </div>

      <div className="recipe-card__section">
        <h4>Ingredients</h4>
        <ul>
          {recipe.ingredients.map((ingredient) => (
            <li key={ingredient}>{ingredient}</li>
          ))}
        </ul>
      </div>

      {recipe.missingIngredients.length > 0 && (
        <div className="recipe-card__section recipe-card__missing">
          <h4>Missing ingredients</h4>
          <ul>
            {recipe.missingIngredients.map((ingredient) => (
              <li key={ingredient}>{ingredient}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="recipe-card__section">
        <h4>Instructions</h4>
        <ol>
          {recipe.instructions.map((step, stepIndex) => (
            <li key={`${recipe.name}-step-${stepIndex}`}>{step}</li>
          ))}
        </ol>
      </div>
    </article>
  )
}
