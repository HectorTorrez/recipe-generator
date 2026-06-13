import { describe, expect, it, beforeEach, vi } from 'vitest'
import { MAX_HISTORY_ENTRIES } from './history-limits'

const storage: Record<string, string> = {}

vi.stubGlobal('window', {
  localStorage: {
    getItem: (key: string) => storage[key] ?? null,
    setItem: (key: string, value: string) => {
      storage[key] = value
    },
    removeItem: (key: string) => {
      delete storage[key]
    },
  },
})

vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage[key] ?? null,
  setItem: (key: string, value: string) => {
    storage[key] = value
  },
  removeItem: (key: string) => {
    delete storage[key]
  },
})

vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid-' + Math.random().toString(36).slice(2, 8),
})

describe('guest history', () => {
  beforeEach(async () => {
    Object.keys(storage).forEach((k) => delete storage[k])
    vi.resetModules()
  })

  it('appends and respects limit', async () => {
    const { appendGuestHistoryEntry, loadGuestHistory } = await import(
      './guest-history'
    )

    for (let i = 0; i < MAX_HISTORY_ENTRIES + 1; i++) {
      appendGuestHistoryEntry(
        { ingredients: [`item-${i}`], cookingTimeMinutes: 10 },
        [
          {
            name: `Recipe ${i}`,
            description: 'd',
            estimatedTimeMinutes: 10,
            ingredients: ['a'],
            instructions: ['step'],
            whyRecommended: 'why',
          },
        ],
      )
    }

    const entries = loadGuestHistory()
    expect(entries).toHaveLength(MAX_HISTORY_ENTRIES)
  })
})
