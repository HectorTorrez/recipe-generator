import { useEffect, useRef } from 'react'
import { authClient } from '../lib/auth-client'
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
    if (!hasGuestHistory()) return

    migratedRef.current = true

    void (async () => {
      try {
        const entries = loadGuestHistory()

        if (entries.length === 0) return

        await migrateGuestHistory(entries)
        clearGuestHistory()
        onMigrated?.()
      } catch {
        migratedRef.current = false
      }
    })()
  }, [isPending, session?.user, onMigrated])
}
