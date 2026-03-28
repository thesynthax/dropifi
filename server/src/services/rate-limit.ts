import { redis } from "../lib/redis.js";
import * as config from "../../config/config.json" with { type: "json" };

export interface RateLimitResult {
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
    resetAt: Date;
    retryAfterMs?: number;
}

export async function checkRateLimit(
    identifier: string
): Promise<RateLimitResult> {
    if (!config.default.RATE_LIMIT_ENABLED) {
        return {
            allowed: true,
            current: 0,
            limit: Infinity,
            remaining: Infinity,
            resetAt: new Date(Date.now() + config.default.RATE_LIMIT_WINDOW_MS)
        };
    }

    const window = config.default.RATE_LIMIT_WINDOW_MS;
    const max = config.default.RATE_LIMIT_MAX_REQUESTS;
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowStart = now - window;

    try {
        const multi = redis.multi();

        multi.zremrangebyscore(key, 0, windowStart);

        multi.zadd(key, `${now}`, `${now}`);

        multi.zcard(key);

        multi.pexpire(key, window);

        const results = await multi.exec();

        if (!results) {
            return {
                allowed: true,
                current: 0,
                limit: max,
                remaining: max,
                resetAt: new Date(now + window)
            };
        }

        const countResult = results[2];
        const currentCount = (countResult?.[1] as number) ?? 0;

        if (currentCount > max) {
            const oldestEntries = await redis.zrange(key, 0, 0, "WITHSCORES");
            const oldestTimestampStr = oldestEntries[1];
            const oldestTimestamp = oldestTimestampStr ? parseInt(oldestTimestampStr) : now;
            const resetAt = new Date(oldestTimestamp + window);
            const retryAfterMs = resetAt.getTime() - now;

            return {
                allowed: false,
                current: currentCount,
                limit: max,
                remaining: 0,
                resetAt,
                retryAfterMs
            };
        }

        return {
            allowed: true,
            current: currentCount,
            limit: max,
            remaining: Math.max(0, max - currentCount),
            resetAt: new Date(now + window)
        };
    } catch (err) {
        console.error("Rate limit check failed:", err);
        return {
            allowed: true,
            current: 0,
            limit: max,
            remaining: max,
            resetAt: new Date(now + window)
        };
    }
}

export function getClientIdentifier(request: { ip?: string; headers?: Record<string, string | string[]> }): string {
    if (config.default.TRUST_PROXY) {
        const forwarded = request.headers?.["x-forwarded-for"];
        if (forwarded) {
            const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
            if (forwardedValue) {
                const ips = forwardedValue.split(",");
                const firstIp = ips[0];
                if (firstIp) {
                    return firstIp.trim();
                }
            }
        }
    }
    return request.ip ?? "unknown";
}
