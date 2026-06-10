// Keep in sync with src/lib/generation-limits.ts
export const GUEST_GENERATIONS_PER_HOUR = 10
export const USER_GENERATIONS_PER_DAY = 30

export class RateLimitExceededError extends Error {
  readonly retryAfterSeconds: number

  constructor(message: string, retryAfterSeconds: number) {
    super(message)
    this.name = 'RateLimitExceededError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function getGuestWindowKey(now = new Date()): string {
  return `hour:${now.toISOString().slice(0, 13)}`
}

function getUserWindowKey(now = new Date()): string {
  return `day:${now.toISOString().slice(0, 10)}`
}

function getClientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ??
    'local'
  )
}

function secondsUntilNextHour(now = new Date()): number {
  const next = new Date(now)
  next.setUTCMinutes(0, 0, 0)
  next.setUTCHours(next.getUTCHours() + 1)
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000))
}

function secondsUntilNextDay(now = new Date()): number {
  const next = new Date(now)
  next.setUTCHours(0, 0, 0, 0)
  next.setUTCDate(next.getUTCDate() + 1)
  return Math.max(1, Math.ceil((next.getTime() - now.getTime()) / 1000))
}

async function tryConsume(
  db: D1Database,
  bucketKey: string,
  windowKey: string,
  limit: number,
): Promise<boolean> {
  const update = await db
    .prepare(
      `UPDATE generation_rate_limits
       SET count = count + 1
       WHERE bucket_key = ? AND window_key = ? AND count < ?`,
    )
    .bind(bucketKey, windowKey, limit)
    .run()

  if ((update.meta.changes ?? 0) > 0) return true

  const existing = await db
    .prepare(
      `SELECT count FROM generation_rate_limits
       WHERE bucket_key = ? AND window_key = ?`,
    )
    .bind(bucketKey, windowKey)
    .first<{ count: number }>()

  if (existing) return false

  try {
    await db
      .prepare(
        `INSERT INTO generation_rate_limits (bucket_key, window_key, count)
         VALUES (?, ?, 1)`,
      )
      .bind(bucketKey, windowKey)
      .run()
    return true
  } catch {
    const retry = await db
      .prepare(
        `UPDATE generation_rate_limits
         SET count = count + 1
         WHERE bucket_key = ? AND window_key = ? AND count < ?`,
      )
      .bind(bucketKey, windowKey, limit)
      .run()

    return (retry.meta.changes ?? 0) > 0
  }
}

export async function enforceGenerationRateLimit(
  db: D1Database,
  request: Request,
  userId: string | null,
): Promise<void> {
  const now = new Date()

  if (userId) {
    const allowed = await tryConsume(
      db,
      `user:${userId}`,
      getUserWindowKey(now),
      USER_GENERATIONS_PER_DAY,
    )

    if (!allowed) {
      throw new RateLimitExceededError(
        `You've reached the limit of ${USER_GENERATIONS_PER_DAY} generations per day. Try again later.`,
        secondsUntilNextDay(now),
      )
    }

    return
  }

  const allowed = await tryConsume(
    db,
    `ip:${getClientIp(request)}`,
    getGuestWindowKey(now),
    GUEST_GENERATIONS_PER_HOUR,
  )

  if (!allowed) {
    throw new RateLimitExceededError(
      `You've reached the limit of ${GUEST_GENERATIONS_PER_HOUR} generations per hour. Sign in for a higher limit, or try again later.`,
      secondsUntilNextHour(now),
    )
  }
}
