import { useEffect, useRef, useState } from 'react'
import type { Recipe } from '../types/recipe'

type CookModeProps = {
  recipe: Recipe
  onClose: () => void
}

export function CookMode({ recipe, onClose }: CookModeProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const stepIndexRef = useRef(stepIndex)
  stepIndexRef.current = stepIndex

  const totalSteps = recipe.instructions.length
  const stepMinutes = Math.max(
    1,
    Math.round(recipe.estimatedTimeMinutes / Math.max(totalSteps, 1)),
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!dialog.open) dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
    }
  }, [])

  function dismiss() {
    onClose()
  }

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const currentStep = stepIndexRef.current

      if (event.key === 'ArrowRight' && currentStep < totalSteps - 1) {
        setStepIndex(currentStep + 1)
        setSecondsLeft(null)
      }

      if (event.key === 'ArrowLeft' && currentStep > 0) {
        setStepIndex(currentStep - 1)
        setSecondsLeft(null)
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [totalSteps])

  useEffect(() => {
    if (secondsLeft === null || secondsLeft <= 0) return
    const timer = window.setTimeout(() => {
      setSecondsLeft((s) => (s !== null && s > 0 ? s - 1 : 0))
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [secondsLeft])

  return (
    <dialog
      ref={dialogRef}
      className="cook-mode"
      aria-label={`Cooking ${recipe.name}`}
      onCancel={dismiss}
    >
      <header className="cook-mode__header">
        <div>
          <p className="cook-mode__eyebrow">Cook mode</p>
          <h2 className="cook-mode__title">{recipe.name}</h2>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={dismiss}>
          Exit
        </button>
      </header>

      <div className="cook-mode__progress">
        Step {stepIndex + 1} of {totalSteps}
      </div>

      <p className="cook-mode__step">{recipe.instructions[stepIndex]}</p>

      <div className="cook-mode__timer">
        {secondsLeft !== null && secondsLeft > 0 ? (
          <p className="cook-mode__countdown">{secondsLeft}s remaining</p>
        ) : (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSecondsLeft(stepMinutes * 60)}
          >
            Start {stepMinutes} min timer
          </button>
        )}
      </div>

      <footer className="cook-mode__footer">
        <button
          type="button"
          className="btn btn-ghost"
          disabled={stepIndex === 0}
          onClick={() => {
            setStepIndex((i) => i - 1)
            setSecondsLeft(null)
          }}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={stepIndex >= totalSteps - 1}
          onClick={() => {
            setStepIndex((i) => i + 1)
            setSecondsLeft(null)
          }}
        >
          Next step
        </button>
      </footer>
    </dialog>
  )
}
