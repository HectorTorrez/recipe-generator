import { useEffect } from 'react'

type ToastProps = {
  message: string
  onDismiss: () => void
}

export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 2000)
    return () => window.clearTimeout(id)
  }, [onDismiss])

  return (
    <div className="toast" role="status" aria-live="polite">
      <p>{message}</p>
    </div>
  )
}
