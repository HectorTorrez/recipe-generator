import { useState } from 'react'
import { recipeToMarkdown } from '../lib/recipeMarkdown'
import type { Recipe } from '../types/recipe'

type RecipeCardProps = {
  recipe: Recipe
  index: number
}

export function RecipeCard({ recipe, index }: RecipeCardProps) {
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
        <span className="recipe-card__badge">#{index + 1}</span>
        <div className="recipe-card__heading">
          <h3 className="recipe-card__title">{recipe.name}</h3>
          <p className="recipe-card__time">
            {recipe.estimatedTimeMinutes} min estimated
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm recipe-card__copy"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy recipe'}
        </button>
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
