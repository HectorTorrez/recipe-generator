import { useEffect, useRef, useSyncExternalStore } from 'react'
import { authClient } from '../lib/auth-client'
import { fetchPreferences, savePreferences } from '../lib/api'
import {
  getPreferencesSnapshot,
  getServerPreferencesSnapshot,
  loadPreferences,
  subscribePreferences,
  updatePreferences,
} from '../lib/storage'

export function usePreferencesSync() {
  const { data: session, isPending } = authClient.useSession()
  const preferences = useSyncExternalStore(
    subscribePreferences,
    getPreferencesSnapshot,
    getServerPreferencesSnapshot,
  )
  const syncTimeoutRef = useRef<number | null>(null)
  const lastSyncedRef = useRef<string>('')
  const pulledRef = useRef(false)

  useEffect(() => {
    if (isPending || !session?.user || pulledRef.current) return
    pulledRef.current = true

    void (async () => {
      try {
        const remote = await fetchPreferences()
        const local = loadPreferences()

        if (
          remote.preferences &&
          remote.updatedAt > 0 &&
          JSON.stringify(remote.preferences) !== JSON.stringify(local)
        ) {
          updatePreferences({
            ...local,
            ...(remote.preferences as typeof local),
          })
        } else {
          await savePreferences(local)
          lastSyncedRef.current = JSON.stringify(local)
        }
      } catch {
        pulledRef.current = false
      }
    })()
  }, [isPending, session?.user])

  useEffect(() => {
    if (isPending || !session?.user) return

    const serialized = JSON.stringify(preferences)
    if (serialized === lastSyncedRef.current) return

    if (syncTimeoutRef.current) {
      window.clearTimeout(syncTimeoutRef.current)
    }

    syncTimeoutRef.current = window.setTimeout(() => {
      void savePreferences(preferences)
        .then(() => {
          lastSyncedRef.current = serialized
        })
        .catch(() => {})
    }, 500)

    return () => {
      if (syncTimeoutRef.current) {
        window.clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [isPending, session?.user, preferences])
}
