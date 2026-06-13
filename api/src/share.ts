import type { HistoryEntry } from './history'

const SHARE_TTL_MS = 30 * 24 * 60 * 60 * 1000

export async function createShareLink(
  db: D1Database,
  userId: string,
  entry: HistoryEntry,
): Promise<{ shareId: string; expiresAt: number }> {
  const shareId = crypto.randomUUID()
  const createdAt = Date.now()
  const expiresAt = createdAt + SHARE_TTL_MS

  await db
    .prepare(
      `INSERT INTO shared_generations (id, user_id, entry_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(shareId, userId, JSON.stringify(entry), createdAt, expiresAt)
    .run()

  return { shareId, expiresAt }
}

export async function getSharedGeneration(
  db: D1Database,
  shareId: string,
): Promise<HistoryEntry | null> {
  const row = await db
    .prepare(
      `SELECT entry_json, expires_at FROM shared_generations WHERE id = ?`,
    )
    .bind(shareId)
    .first<{ entry_json: string; expires_at: number | null }>()

  if (!row) return null

  if (row.expires_at && row.expires_at < Date.now()) return null

  try {
    return JSON.parse(row.entry_json) as HistoryEntry
  } catch {
    return null
  }
}
