export interface ProviderUsage {
  requestsThisMinute: number[];
  requestsToday: number;
  tokensToday: number;
  lastResetDay: string;
  consecutiveFailures: number;
  circuitBreakerOpenUntil: number | null;
  retryAfterUntil: number | null;
}

class QuotaTracker {
  private usage: Map<string, ProviderUsage> = new Map();

  private getTodayKey(): string {
    return new Date().toISOString().split("T")[0];
  }

  private getProviderUsage(providerId: string): ProviderUsage {
    const today = this.getTodayKey();
    let record = this.usage.get(providerId);

    if (!record) {
      record = {
        requestsThisMinute: [],
        requestsToday: 0,
        tokensToday: 0,
        lastResetDay: today,
        consecutiveFailures: 0,
        circuitBreakerOpenUntil: null,
        retryAfterUntil: null,
      };
      this.usage.set(providerId, record);
    } else if (record.lastResetDay !== today) {
      // New day reset
      record.requestsToday = 0;
      record.tokensToday = 0;
      record.lastResetDay = today;
      record.consecutiveFailures = 0;
      record.circuitBreakerOpenUntil = null;
    }

    // Clean up timestamps older than 60 seconds
    const now = Date.now();
    record.requestsThisMinute = record.requestsThisMinute.filter((t) => now - t < 60000);

    return record;
  }

  public isAvailable(
    providerId: string,
    limits?: { rpm?: number; rpd?: number; tokensPerDay?: number; neuronsPerDay?: number }
  ): { available: boolean; reason?: string } {
    const usage = this.getProviderUsage(providerId);
    const now = Date.now();

    // 1. Circuit breaker check
    if (usage.circuitBreakerOpenUntil && now < usage.circuitBreakerOpenUntil) {
      return { available: false, reason: `Circuit breaker active until ${new Date(usage.circuitBreakerOpenUntil).toLocaleTimeString()}` };
    }

    // 2. 429 Retry-After check
    if (usage.retryAfterUntil && now < usage.retryAfterUntil) {
      return { available: false, reason: `Rate limited (429) until ${new Date(usage.retryAfterUntil).toLocaleTimeString()}` };
    }

    if (!limits) return { available: true };

    // 3. 80% threshold checks
    if (limits.rpm && usage.requestsThisMinute.length >= limits.rpm * 0.8) {
      return { available: false, reason: `Reached 80% RPM limit (${usage.requestsThisMinute.length}/${limits.rpm})` };
    }

    if (limits.rpd && usage.requestsToday >= limits.rpd * 0.8) {
      return { available: false, reason: `Reached 80% daily request limit (${usage.requestsToday}/${limits.rpd})` };
    }

    if (limits.tokensPerDay && usage.tokensToday >= limits.tokensPerDay * 0.8) {
      return { available: false, reason: `Reached 80% daily token limit (${usage.tokensToday}/${limits.tokensPerDay})` };
    }

    return { available: true };
  }

  public recordSuccess(providerId: string, tokens: number = 0) {
    const usage = this.getProviderUsage(providerId);
    usage.requestsThisMinute.push(Date.now());
    usage.requestsToday += 1;
    usage.tokensToday += tokens;
    usage.consecutiveFailures = 0;
    usage.circuitBreakerOpenUntil = null;
  }

  public recordFailure(providerId: string, is429: boolean = false, retryAfterSeconds?: number) {
    const usage = this.getProviderUsage(providerId);
    const now = Date.now();

    if (is429) {
      const waitMs = (retryAfterSeconds || 60) * 1000;
      usage.retryAfterUntil = now + waitMs;
    }

    usage.consecutiveFailures += 1;
    if (usage.consecutiveFailures >= 3) {
      // Circuit breaker: open for 2 minutes after 3 consecutive failures
      usage.circuitBreakerOpenUntil = now + 2 * 60 * 1000;
    }
  }

  public getStats(providerId: string) {
    return this.getProviderUsage(providerId);
  }
}

export const quotaTracker = new QuotaTracker();
