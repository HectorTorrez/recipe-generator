import { useRef, useState } from 'react'
import { authClient } from '../lib/auth-client'
import {
  addGuestFavorite,
  isGuestFavorite,
  loadGuestFavorites,
  removeGuestFavorite,
} from '../lib/favorites'
import {
  deleteFavorite as deleteFavoriteApi,
  generateSingleRecipe,
  saveFavorite as saveFavoriteApi,
  suggestSubstitution,
} from '../lib/api'
import { recipeToMarkdown } from '../lib/recipeMarkdown'
import { addShoppingItems } from '../lib/shopping-list'
import { CookMode } from './CookMode'
import type { Recipe, RecipeRequest } from '../types/recipe'

type RecipeCardProps = {
  recipe: Recipe
  request?: RecipeRequest
  pantryIngredients?: string[]
  onRecipeUpdate?: (recipe: Recipe) => void
  showActions?: boolean
}

const EMPTY_PANTRY: string[] = []

const REFINE_PRESETS = [
  'Make it spicier',
  'Fewer steps',
  'More protein',
  'Make it vegetarian',
] as const

function getTimeTier(minutes: number): 'quick' | 'medium' | 'long' {
  if (minutes <= 20) return 'quick'
  if (minutes <= 45) return 'medium'
  return 'long'
}

function isFromPantry(ingredient: string, pantry: string[]): boolean {
  const lower = ingredient.toLowerCase()
  return pantry.some(
    (p) => lower.includes(p.toLowerCase()) || p.toLowerCase().includes(lower),
  )
}

export function RecipeCard({
  recipe,
  request,
  pantryIngredients = EMPTY_PANTRY,
  onRecipeUpdate,
  showActions = true,
}: RecipeCardProps) {
  const { data: session } = authClient.useSession()
  const refineDialogRef = useRef<HTMLDialogElement>(null)
  const [copied, setCopied] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)
  const favoriteIdRef = useRef<string | null>(null)
  const [isCooking, setIsCooking] = useState(false)
  const [isRefining, setIsRefining] = useState(false)
  const [refinement, setRefinement] = useState('')
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({})
  const [loadingSubstitute, setLoadingSubstitute] = useState<string | null>(null)

  const guestIsFavorite =
    !session?.user && isGuestFavorite(recipe.name)
  const starred = session?.user ? isFavorite : guestIsFavorite

  function openRefineDialog() {
    setRefinement('')
    refineDialogRef.current?.showModal()
  }

  function closeRefineDialog() {
    refineDialogRef.current?.close()
  }

  const missing =
    recipe.missingIngredients ??
    recipe.ingredients.filter((ing) => !isFromPantry(ing, pantryIngredients))

  const pantryUsed = recipe.ingredients.filter((ing) =>
    isFromPantry(ing, pantryIngredients),
  )

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(recipeToMarkdown(recipe))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  async function handleToggleFavorite() {
    if (!request) return

    if (session?.user) {
      if (isFavorite && favoriteIdRef.current) {
        await deleteFavoriteApi(favoriteIdRef.current)
        setIsFavorite(false)
        favoriteIdRef.current = null
      } else {
        const entry = await saveFavoriteApi(recipe, request)
        setIsFavorite(true)
        favoriteIdRef.current = entry.id
      }
      return
    }

    if (isFavorite) {
      const guestFav = loadGuestFavorites().find((e) => e.recipe.name === recipe.name)
      if (guestFav) removeGuestFavorite(guestFav.id)
      setIsFavorite(false)
    } else {
      addGuestFavorite(recipe, request)
      setIsFavorite(true)
    }
  }

  function handleAddToShoppingList() {
    if (missing.length > 0) {
      addShoppingItems(missing)
    }
  }

  async function handleRegenerate() {
    if (!request || !onRecipeUpdate) return
    setIsRefining(true)
    try {
      const updated = await generateSingleRecipe(request, 'regenerate', recipe)
      onRecipeUpdate(updated)
    } finally {
      setIsRefining(false)
    }
  }

  async function handleRefine() {
    if (!request || !onRecipeUpdate || !refinement.trim()) return
    setIsRefining(true)
    try {
      const updated = await generateSingleRecipe(
        request,
        'refine',
        recipe,
        refinement.trim(),
      )
      onRecipeUpdate(updated)
      closeRefineDialog()
      setRefinement('')
    } finally {
      setIsRefining(false)
    }
  }

  async function handleSuggestSwap(ingredient: string) {
    if (pantryIngredients.length === 0) return
    setLoadingSubstitute(ingredient)
    try {
      const suggestion = await suggestSubstitution(ingredient, pantryIngredients)
      setSubstitutions((prev) => ({ ...prev, [ingredient]: suggestion }))
    } finally {
      setLoadingSubstitute(null)
    }
  }

  return (
    <>
      <article
        className="recipe-card"
        data-time-tier={getTimeTier(recipe.estimatedTimeMinutes)}
      >
        <header className="recipe-card__header">
          <div className="recipe-card__heading">
            <h3 className="recipe-card__title">{recipe.name}</h3>
            <div className="recipe-card__meta">
              <p className="recipe-card__time">
                {recipe.estimatedTimeMinutes} min
                {request?.servings ? ` · ${request.servings} servings` : ''}
              </p>
            </div>
          </div>
          <div className="recipe-card__actions">
            {request && showActions && (
              <button
                type="button"
                className={`btn btn-ghost btn-sm recipe-card__star${starred ? ' recipe-card__star--active' : ''}`}
                onClick={() => void handleToggleFavorite()}
                aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}
              >
                {starred ? '★' : '☆'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm recipe-card__copy"
              onClick={handleCopy}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </header>

        <p className="recipe-card__description">{recipe.description}</p>

        <blockquote className="recipe-card__why">
          <span className="recipe-card__why-label">Why this one</span>
          {recipe.whyRecommended}
        </blockquote>

        <div className="recipe-card__body">
          {pantryUsed.length > 0 && (
            <div className="recipe-card__section recipe-card__section--pantry">
              <h4>From your pantry</h4>
              <ul className="recipe-card__ingredient-list">
                {pantryUsed.map((ingredient) => (
                  <li
                    key={ingredient}
                    className="recipe-card__ingredient recipe-card__ingredient--pantry"
                  >
                    <span className="recipe-card__ingredient-name">{ingredient}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {missing.length > 0 && (
            <div className="recipe-card__section recipe-card__section--missing">
              <h4>You will need</h4>
              <ul className="recipe-card__ingredient-list">
                {missing.map((ingredient) => (
                  <li
                    key={ingredient}
                    className="recipe-card__ingredient recipe-card__ingredient--missing"
                  >
                    <div className="recipe-card__ingredient-row">
                      <span className="recipe-card__ingredient-name">{ingredient}</span>
                      {showActions && pantryIngredients.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm recipe-card__swap-btn"
                          disabled={loadingSubstitute === ingredient}
                          onClick={() => void handleSuggestSwap(ingredient)}
                        >
                          {loadingSubstitute === ingredient ? '…' : 'Suggest swap'}
                        </button>
                      )}
                    </div>
                    {substitutions[ingredient] && (
                      <p className="recipe-card__substitution">
                        {substitutions[ingredient]}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {showActions && (
                <div className="recipe-card__section-actions">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleAddToShoppingList}
                  >
                    Add to shopping list
                  </button>
                </div>
              )}
            </div>
          )}

          {pantryIngredients.length === 0 && (
            <div className="recipe-card__section">
              <h4>Ingredients</h4>
              <ul>
                {recipe.ingredients.map((ingredient) => (
                  <li key={ingredient}>{ingredient}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="recipe-card__section recipe-card__section--steps">
            <h4>Steps</h4>
            <ol>
              {recipe.instructions.map((step, stepIndex) => (
                <li key={`${recipe.name}-step-${stepIndex}`}>{step}</li>
              ))}
            </ol>
          </div>
        </div>

        {showActions && (
          <footer className="recipe-card__footer">
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={() => setIsCooking(true)}
            >
              Start cooking
            </button>
            {request && onRecipeUpdate && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={isRefining}
                  onClick={() => void handleRegenerate()}
                >
                  {isRefining ? '…' : 'Regenerate'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={openRefineDialog}
                >
                  Refine
                </button>
              </>
            )}
          </footer>
        )}
      </article>

      {isCooking && (
        <CookMode recipe={recipe} onClose={() => setIsCooking(false)} />
      )}

      <dialog
        ref={refineDialogRef}
        className="auth-modal refine-modal"
        aria-labelledby="refine-modal-title"
        onClose={() => setRefinement('')}
      >
          <header className="auth-modal__header">
            <h2 id="refine-modal-title">Refine recipe</h2>
            <button
              type="button"
              className="auth-modal__close"
              onClick={closeRefineDialog}
              aria-label="Close refine dialog"
            >
              ×
            </button>
          </header>
          <div className="refine-modal__presets">
            {REFINE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setRefinement(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          <label className="form-label" htmlFor="refine-input">
            Refinement details
          </label>
          <textarea
            id="refine-input"
            className="refine-modal__input"
            value={refinement}
            onChange={(e) => setRefinement(e.target.value)}
            placeholder="Describe how to change this recipe…"
            rows={3}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={isRefining || !refinement.trim()}
            onClick={() => void handleRefine()}
          >
            {isRefining ? 'Refining…' : 'Apply refinement'}
          </button>
      </dialog>
    </>
  )
}
