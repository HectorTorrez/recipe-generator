export async function getUserPreferences(
  db: D1Database,
  userId: string,
): Promise<{ preferences: unknown; updatedAt: number } | null> {
  const row = await db
    .prepare(
      `SELECT preferences_json, updated_at FROM user_preferences WHERE user_id = ?`,
    )
    .bind(userId)
    .first<{ preferences_json: string; updated_at: number }>()

  if (!row) return null

  try {
    return {
      preferences: JSON.parse(row.preferences_json),
      updatedAt: row.updated_at,
    }
  } catch {
    return null
  }
}

export async function saveUserPreferences(
  db: D1Database,
  userId: string,
  preferences: unknown,
): Promise<{ updatedAt: number }> {
  const updatedAt = Date.now()

  await db
    .prepare(
      `INSERT INTO user_preferences (user_id, preferences_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         preferences_json = excluded.preferences_json,
         updated_at = excluded.updated_at`,
    )
    .bind(userId, JSON.stringify(preferences), updatedAt)
    .run()

  return { updatedAt }
}
