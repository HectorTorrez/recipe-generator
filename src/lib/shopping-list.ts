import type { ShoppingListItem } from '../types/recipe'

const SHOPPING_LIST_KEY = 'recipe-generator-shopping-list'

const listeners = new Set<() => void>()
let snapshot: ShoppingListItem[] = []

function notify() {
  listeners.forEach((listener) => listener())
}

export function subscribeShoppingList(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange)
  return () => listeners.delete(onStoreChange)
}

export function getShoppingListSnapshot(): ShoppingListItem[] {
  return snapshot
}

export function getServerShoppingListSnapshot(): ShoppingListItem[] {
  return []
}

export function reloadShoppingList(): void {
  if (typeof window === 'undefined') return
  snapshot = loadShoppingList()
  notify()
}

export function loadShoppingList(): ShoppingListItem[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = localStorage.getItem(SHOPPING_LIST_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter(
      (item): item is ShoppingListItem =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as ShoppingListItem).id === 'string' &&
        typeof (item as ShoppingListItem).name === 'string',
    )
  } catch {
    return []
  }
}

if (typeof window !== 'undefined') {
  snapshot = loadShoppingList()
}

function persist(items: ShoppingListItem[]): ShoppingListItem[] {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SHOPPING_LIST_KEY, JSON.stringify(items))
  }
  snapshot = items
  notify()
  return items
}

export function addShoppingItems(names: string[]): {
  items: ShoppingListItem[]
  addedCount: number
} {
  const current = loadShoppingList()
  const existing = new Set(current.map((item) => item.name.toLowerCase()))

  const newItems = names.flatMap((name) => {
    const trimmed = name.trim()
    if (!trimmed || existing.has(trimmed.toLowerCase())) return []
    existing.add(trimmed.toLowerCase())
    return [{ id: crypto.randomUUID(), name: trimmed, checked: false }]
  })

  return {
    items: persist([...current, ...newItems]),
    addedCount: newItems.length,
  }
}

export function toggleShoppingItem(id: string): ShoppingListItem[] {
  return persist(
    loadShoppingList().map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item,
    ),
  )
}

export function removeShoppingItem(id: string): ShoppingListItem[] {
  return persist(loadShoppingList().filter((item) => item.id !== id))
}

export function clearCheckedItems(): ShoppingListItem[] {
  return persist(loadShoppingList().filter((item) => !item.checked))
}
