import { useRef, useState } from 'react'
import { detectIngredientsFromImage } from '../lib/api'
import type {
  Cuisine,
  DietaryPreference,
  Difficulty,
  Equipment,
  MealType,
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

const CUISINE_OPTIONS: { value: Cuisine | ''; label: string }[] = [
  { value: '', label: 'Any cuisine' },
  { value: 'italian', label: 'Italian' },
  { value: 'mexican', label: 'Mexican' },
  { value: 'asian', label: 'Asian' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'american', label: 'American' },
]

const MEAL_OPTIONS: { value: MealType | ''; label: string }[] = [
  { value: '', label: 'Any meal' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
]

function parseIngredientList(text: string): string[] {
  return text
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function mergeIngredients(existing: string[], incoming: string[]): string[] {
  const lower = new Set(existing.map((i) => i.toLowerCase()))
  const merged = [...existing]
  for (const item of incoming) {
    if (!lower.has(item.toLowerCase())) {
      merged.push(item)
      lower.add(item.toLowerCase())
    }
  }
  return merged
}

type RecipeFormProps = {
  preferences: UserPreferences
  onChange: (preferences: UserPreferences) => void
  onSubmit: () => void
  isLoading: boolean
  quotaExceeded?: boolean
  quotaMessage?: string | null
  useStreaming?: boolean
  onStreamingChange?: (value: boolean) => void
}

export function RecipeForm({
  preferences,
  onChange,
  onSubmit,
  isLoading,
  quotaExceeded = false,
  quotaMessage = null,
  useStreaming = true,
  onStreamingChange,
}: RecipeFormProps) {
  const [ingredientInput, setIngredientInput] = useState('')
  const [pasteInput, setPasteInput] = useState('')
  const [allergyInput, setAllergyInput] = useState('')
  const [detectedIngredients, setDetectedIngredients] = useState<string[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function updatePreferences(patch: Partial<UserPreferences>) {
    onChange({ ...preferences, ...patch })
  }

  function addIngredient(value?: string) {
    const trimmed = (value ?? ingredientInput).trim()
    if (!trimmed) return

    const exists = preferences.ingredients.some(
      (item) => item.toLowerCase() === trimmed.toLowerCase(),
    )

    if (exists) {
      setIngredientInput('')
      return
    }

    updatePreferences({
      ingredients: [...preferences.ingredients, trimmed],
    })
    setIngredientInput('')
  }

  function removeIngredient(ingredient: string) {
    updatePreferences({
      ingredients: preferences.ingredients.filter((item) => item !== ingredient),
    })
  }

  function handlePasteIngredients() {
    const parsed = parseIngredientList(pasteInput)
    if (parsed.length === 0) return
    updatePreferences({
      ingredients: mergeIngredients(preferences.ingredients, parsed),
    })
    setPasteInput('')
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

  function addAllergy() {
    const value = allergyInput.trim()
    if (!value) return
    const exists = preferences.allergies.some(
      (a) => a.toLowerCase() === value.toLowerCase(),
    )
    if (exists) {
      setAllergyInput('')
      return
    }
    updatePreferences({ allergies: [...preferences.allergies, value] })
    setAllergyInput('')
  }

  function removeAllergy(allergy: string) {
    updatePreferences({
      allergies: preferences.allergies.filter((a) => a !== allergy),
    })
  }

  async function handleImageUpload(file: File) {
    setIsScanning(true)
    setScanError(null)
    setDetectedIngredients([])

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Failed to read image'))
        reader.readAsDataURL(file)
      })

      const ingredients = await detectIngredientsFromImage(base64)
      setDetectedIngredients(ingredients)
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Failed to analyze image',
      )
    } finally {
      setIsScanning(false)
    }
  }

  function acceptDetected(selected: string[]) {
    updatePreferences({
      ingredients: mergeIngredients(preferences.ingredients, selected),
    })
    setDetectedIngredients([])
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
          <button type="button" className="btn btn-secondary" onClick={() => addIngredient()}>
            Add
          </button>
        </div>

        <label className="form-label" htmlFor="paste-ingredients">
          Paste ingredients
        </label>
        <textarea
          id="paste-ingredients"
          className="paste-input"
          value={pasteInput}
          onChange={(e) => setPasteInput(e.target.value)}
          placeholder="chicken, rice, onion, garlic"
          rows={2}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handlePasteIngredients}
          disabled={!pasteInput.trim()}
        >
          Add pasted ingredients
        </button>

        <div className="photo-scan">
          <label className="form-label" htmlFor="photo-scan-input">
            Scan ingredients from photo
          </label>
          <input
            id="photo-scan-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="photo-scan__input"
            aria-label="Upload a photo of ingredients"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImageUpload(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={isScanning}
            onClick={() => fileInputRef.current?.click()}
          >
            {isScanning ? 'Scanning…' : 'Scan photo'}
          </button>
        </div>

        {scanError && (
          <p className="form-hint form-hint--error" role="alert">
            {scanError}
          </p>
        )}

        {detectedIngredients.length > 0 && (
          <div className="detected-ingredients">
            <p className="form-hint">Detected ingredients — select to add:</p>
            <ul className="ingredient-list">
              {detectedIngredients.map((ing) => (
                <li key={ing} className="ingredient-tag">
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
            <div className="detected-ingredients__actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => acceptDetected(detectedIngredients)}
              >
                Add all
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setDetectedIngredients([])}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

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
        <label className="form-label" htmlFor="servings">
          Servings
        </label>
        <input
          id="servings"
          type="number"
          min={1}
          max={12}
          value={preferences.servings}
          onChange={(e) =>
            updatePreferences({
              servings: Math.max(1, Math.min(12, Number(e.target.value) || 2)),
            })
          }
        />
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
        <span className="form-label">Meal type</span>
        <div className="option-grid option-grid--wrap">
          {MEAL_OPTIONS.map((option) => (
            <label key={option.value || 'any'} className="option-chip">
              <input
                type="radio"
                name="meal-type"
                checked={(preferences.mealType ?? '') === option.value}
                onChange={() =>
                  updatePreferences({
                    mealType: option.value || undefined,
                  })
                }
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="form-section">
        <span className="form-label">Cuisine</span>
        <div className="option-grid option-grid--wrap">
          {CUISINE_OPTIONS.map((option) => (
            <label key={option.value || 'any'} className="option-chip">
              <input
                type="radio"
                name="cuisine"
                checked={(preferences.cuisine ?? '') === option.value}
                onChange={() =>
                  updatePreferences({
                    cuisine: option.value || undefined,
                  })
                }
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
        <label className="form-label" htmlFor="allergy-input">
          Allergies to avoid
        </label>
        <div className="ingredient-input-row">
          <input
            id="allergy-input"
            type="text"
            value={allergyInput}
            placeholder="e.g. nuts"
            onChange={(e) => setAllergyInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addAllergy()
              }
            }}
          />
          <button type="button" className="btn btn-secondary" onClick={addAllergy}>
            Add
          </button>
        </div>
        {preferences.allergies.length > 0 && (
          <ul className="ingredient-list">
            {preferences.allergies.map((allergy) => (
              <li key={allergy} className="ingredient-tag">
                <span>{allergy}</span>
                <button
                  type="button"
                  aria-label={`Remove ${allergy}`}
                  onClick={() => removeAllergy(allergy)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
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

      {onStreamingChange && (
        <label className="option-chip streaming-toggle">
          <input
            type="checkbox"
            checked={useStreaming}
            onChange={(e) => onStreamingChange(e.target.checked)}
          />
          <span>Show recipes as they arrive</span>
        </label>
      )}

      {quotaMessage && (
        <p className="form-hint quota-hint" role="status">
          {quotaMessage}
        </p>
      )}

      {preferences.ingredients.length === 0 && (
        <p className="form-hint" role="status" aria-live="polite">
          Add at least one ingredient to generate recipes.
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary"
        disabled={
          isLoading || preferences.ingredients.length === 0 || quotaExceeded
        }
        onClick={onSubmit}
      >
        {isLoading ? 'Generating…' : 'Generate recipes'}
      </button>
    </form>
  )
}
