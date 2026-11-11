/**
 * Server-side in-memory Sliding Window Rate Limiter
 * Ensures safe usage and protects against rapid accidental calls or spam.
 */

interface RateLimitRecord {
  timestamps: number[]
}

class SlidingWindowRateLimiter {
  private records: Map<string, RateLimitRecord> = new Map()
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests = 15, windowMs = 60 * 1000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs

    // Periodic cleanup of stale entries every 5 minutes
    if (typeof setInterval !== 'undefined') {
      const interval = setInterval(() => {
        const now = Date.now()
        for (const [key, record] of this.records.entries()) {
          const valid = record.timestamps.filter((t) => now - t < this.windowMs)
          if (valid.length === 0) {
            this.records.delete(key)
          } else {
            record.timestamps = valid
          }
        }
      }, 5 * 60 * 1000)
      if (typeof interval.unref === 'function') {
        interval.unref()
      }
    }
  }

  /**
   * Check if a user is permitted to make a request.
   * If permitted, records the timestamp and returns allowed: true.
   * If exceeded, returns allowed: false with retryAfterSeconds.
   */
  public checkLimit(userId: string): { allowed: boolean; retryAfterSeconds?: number; remaining: number } {
    const now = Date.now()
    const record = this.records.get(userId) || { timestamps: [] }

    // Filter out timestamps outside the active window
    const recent = record.timestamps.filter((t) => now - t < this.windowMs)
    this.records.set(userId, { timestamps: recent })

    if (recent.length >= this.maxRequests) {
      const oldest = recent[0]
      const retryAfterMs = this.windowMs - (now - oldest)
      const retryAfterSeconds = Math.max(1, Math.ceil(retryAfterMs / 1000))
      return {
        allowed: false,
        retryAfterSeconds,
        remaining: 0,
      }
    }

    recent.push(now)
    return {
      allowed: true,
      remaining: this.maxRequests - recent.length,
    }
  }
}

// Global singleton instance
export const aiRateLimiter = new SlidingWindowRateLimiter(15, 60 * 1000)
