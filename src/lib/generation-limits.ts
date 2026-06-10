// Keep in sync with api/src/rate-limit.ts
export const GUEST_GENERATIONS_PER_HOUR = 10
export const USER_GENERATIONS_PER_DAY = 30

export const GENERATION_LIMIT_HINT = `Guests can generate up to ${GUEST_GENERATIONS_PER_HOUR} times per hour; signed-in users get up to ${USER_GENERATIONS_PER_DAY} per day.`
