// Sliding-window limiter: at most `limit` events within any `windowMs`.
export class RateLimiter {
  private times: number[] = [];

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  // Records an event and returns whether it is within the limit.
  allow(now: number = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    while (this.times.length > 0 && this.times[0] <= cutoff) this.times.shift();
    if (this.times.length >= this.limit) return false;
    this.times.push(now);
    return true;
  }
}
