import { useState } from 'react'
import type {
  DietaryPreference,
  Difficulty,
  Equipment,
  UserPreferences,
} from '../types/recipe'

const TIME_OPTIONS = [
  { label: '10 min', value: 10 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60+ min', value: 90 },
] as const

const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

const DIETARY_OPTIONS: { value: DietaryPreference; label: string }[] = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'gluten-free', label: 'Gluten-Free' },
  { value: 'low-carb', label: 'Low Carb' },
  { value: 'high-protein', label: 'High Protein' },
]

const EQUIPMENT_OPTIONS: { value: Equipment; label: string }[] = [
  { value: 'stove', label: 'Stove' },
  { value: 'oven', label: 'Oven' },
  { value: 'air-fryer', label: 'Air Fryer' },
  { value: 'microwave', label: 'Microwave' },
]

type RecipeFormProps = {
  preferences: UserPreferences
  onChange: (preferences: UserPreferences) => void
  onSubmit: () => void
  isLoading: boolean
}

export function RecipeForm({
  preferences,
  onChange,
  onSubmit,
  isLoading,
}: RecipeFormProps) {
  const [ingredientInput, setIngredientInput] = useState('')

  function updatePreferences(patch: Partial<UserPreferences>) {
    onChange({ ...preferences, ...patch })
  }

  function addIngredient() {
    const value = ingredientInput.trim()
    if (!value) return

    const exists = preferences.ingredients.some(
      (item) => item.toLowerCase() === value.toLowerCase(),
    )

    if (exists) {
      setIngredientInput('')
      return
    }

    updatePreferences({
      ingredients: [...preferences.ingredients, value],
    })
    setIngredientInput('')
  }

  function removeIngredient(ingredient: string) {
    updatePreferences({
      ingredients: preferences.ingredients.filter((item) => item !== ingredient),
    })
  }

  function toggleDietary(value: DietaryPreference) {
    const current = preferences.dietaryPreferences
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]

    updatePreferences({ dietaryPreferences: next })
  }

  function toggleEquipment(value: Equipment) {
    const current = preferences.equipment
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]

    updatePreferences({ equipment: next.length > 0 ? next : ['stove'] })
  }

  return (
    <form className="recipe-form">
      <section className="form-section">
        <label className="form-label" htmlFor="ingredient-input">
          Ingredients
        </label>
        <p className="form-hint">
          Whatever's in the fridge, pantry, or counter — add it here.
        </p>

        <div className="ingredient-input-row">
          <input
            id="ingredient-input"
            type="text"
            value={ingredientInput}
            placeholder="e.g. chicken breast"
            onChange={(event) => setIngredientInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addIngredient()
              }
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={addIngredient}>
            Add
          </button>
        </div>

        {preferences.ingredients.length > 0 ? (
          <ul className="ingredient-list">
            {preferences.ingredients.map((ingredient) => (
              <li key={ingredient} className="ingredient-tag">
                <span>{ingredient}</span>
                <button
                  type="button"
                  aria-label={`Remove ${ingredient}`}
                  onClick={() => removeIngredient(ingredient)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-state">Nothing added yet.</p>
        )}
      </section>

      <section className="form-section">
        <span className="form-label">Available cooking time</span>
        <div className="option-grid">
          {TIME_OPTIONS.map((option) => (
            <label key={option.value} className="option-chip">
              <input
                type="radio"
                name="cooking-time"
                checked={preferences.cookingTimeMinutes === option.value}
                onChange={() =>
                  updatePreferences({ cookingTimeMinutes: option.value })
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <span className="form-label">Cooking difficulty</span>
        <div className="option-grid">
          {DIFFICULTY_OPTIONS.map((option) => (
            <label key={option.value} className="option-chip">
              <input
                type="radio"
                name="difficulty"
                checked={preferences.difficulty === option.value}
                onChange={() => updatePreferences({ difficulty: option.value })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <span className="form-label">Dietary preferences</span>
        <div className="option-grid option-grid--wrap">
          {DIETARY_OPTIONS.map((option) => (
            <label key={option.value} className="option-chip">
              <input
                type="checkbox"
                checked={preferences.dietaryPreferences.includes(option.value)}
                onChange={() => toggleDietary(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <span className="form-label">Available equipment</span>
        <div className="option-grid option-grid--wrap">
          {EQUIPMENT_OPTIONS.map((option) => (
            <label key={option.value} className="option-chip">
              <input
                type="checkbox"
                checked={preferences.equipment.includes(option.value)}
                onChange={() => toggleEquipment(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      {preferences.ingredients.length === 0 && (
        <p className="form-hint" role="status" aria-live="polite">
          Add at least one ingredient to generate recipes.
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={isLoading || preferences.ingredients.length === 0}
        onClick={onSubmit}
      >
        {isLoading ? 'Generating…' : 'Generate recipes'}
      </button>
    </form>
  )
}
