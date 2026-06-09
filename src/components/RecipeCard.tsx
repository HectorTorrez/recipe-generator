import { useState } from 'react'
import { recipeToMarkdown } from '../lib/recipeMarkdown'
import type { Recipe } from '../types/recipe'

type RecipeCardProps = {
  recipe: Recipe
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(recipeToMarkdown(recipe))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className="recipe-card">
      <header className="recipe-card__header">
        <div className="recipe-card__heading">
          <h3 className="recipe-card__title">{recipe.name}</h3>
          <div className="recipe-card__meta">
            <p className="recipe-card__time">
              {recipe.estimatedTimeMinutes} min
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm recipe-card__copy"
          onClick={handleCopy}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </header>

      <p className="recipe-card__description">{recipe.description}</p>

      <blockquote className="recipe-card__why">
        <span className="recipe-card__why-label">Why this one</span>
        {recipe.whyRecommended}
      </blockquote>

      <div className="recipe-card__body">
        <div className="recipe-card__section">
          <h4>Ingredients</h4>
          <ul>
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient}>{ingredient}</li>
            ))}
          </ul>
        </div>

        <div className="recipe-card__section recipe-card__section--steps">
          <h4>Steps</h4>
          <ol>
            {recipe.instructions.map((step, stepIndex) => (
              <li key={`${recipe.name}-step-${stepIndex}`}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    </article>
  )
}
