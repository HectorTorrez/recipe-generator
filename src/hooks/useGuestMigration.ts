import { useEffect, useRef } from 'react'
import { authClient } from '../lib/auth-client'
import {
  clearGuestFavorites,
  hasGuestFavorites,
  loadGuestFavorites,
} from '../lib/favorites'
import { migrateGuestFavorites } from '../lib/api'
import {
  clearGuestHistory,
  hasGuestHistory,
  loadGuestHistory,
} from '../lib/guest-history'
import { migrateGuestHistory } from '../lib/history-api'

export function useGuestMigration(onMigrated?: () => void) {
  const { data: session, isPending } = authClient.useSession()
  const migratedRef = useRef(false)

  useEffect(() => {
    if (isPending || !session?.user || migratedRef.current) return
    if (!hasGuestHistory() && !hasGuestFavorites()) return

    migratedRef.current = true

    void (async () => {
      try {
        if (hasGuestHistory()) {
          const entries = loadGuestHistory()
          if (entries.length > 0) {
            await migrateGuestHistory(entries)
            clearGuestHistory()
          }
        }

        if (hasGuestFavorites()) {
          const favorites = loadGuestFavorites()
          if (favorites.length > 0) {
            await migrateGuestFavorites(favorites)
            clearGuestFavorites()
          }
        }

        onMigrated?.()
      } catch {
        migratedRef.current = false
      }
    })()
  }, [isPending, session?.user, onMigrated])
}
