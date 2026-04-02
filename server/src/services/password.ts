import bcrypt from "bcrypt";
import * as config from "../../config/config.json" with { type: "json" };
import { redis } from "../lib/redis.js";

export interface PasswordValidationResult {
    valid: boolean;
    error?: string;
}

export interface AuthCheckResult {
    allowed: boolean;
    error?: string;
    retryAfterMs?: number;
}

export function extractBasicAuthPassword(authorizationHeader: string | undefined): string | undefined {
    if (!authorizationHeader) {
        return undefined;
    }

    if (!authorizationHeader.startsWith("Basic ")) {
        return undefined;
    }

    try {
        const base64Credentials = authorizationHeader.slice(6);
        const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
        const parts = credentials.split(":");

        if (parts.length >= 2) {
            parts.shift();
            return parts.join(":");
        }

        return undefined;
    } catch {
        return undefined;
    }
}

function getAuthLockoutKey(storageKey: string): string {
    return `dropifi:auth:lockout:${storageKey}`;
}

function getAuthAttemptsKey(storageKey: string): string {
    return `dropifi:auth:attempts:${storageKey}`;
}

export async function validatePassword(password: string): Promise<PasswordValidationResult> {
    if (!config.default.PASSWORD_PROTECTION_ENABLED) {
        return { valid: true };
    }

    if (!password) {
        return { valid: true };
    }

    if (typeof password !== "string") {
        return { valid: false, error: "Password must be a string" };
    }

    if (password.length < config.default.PASSWORD_MIN_LENGTH) {
        return {
            valid: false,
            error: `Password must be at least ${config.default.PASSWORD_MIN_LENGTH} characters`
        };
    }

    return { valid: true };
}

export async function hashPassword(password: string): Promise<string | null> {
    if (!config.default.PASSWORD_PROTECTION_ENABLED) {
        return null;
    }

    if (!password) {
        return null;
    }

    return bcrypt.hash(password, config.default.BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null): Promise<boolean> {
    if (!hash) {
        return false;
    }

    if (!password) {
        return false;
    }

    return bcrypt.compare(password, hash);
}

export async function checkAuthLockout(storageKey: string): Promise<AuthCheckResult> {
    if (!config.default.PASSWORD_PROTECTION_ENABLED) {
        return { allowed: true };
    }

    const lockoutKey = getAuthLockoutKey(storageKey);
    const ttl = await redis.ttl(lockoutKey);

    if (ttl > 0) {
        return {
            allowed: false,
            error: "Too many failed attempts. File is temporarily locked.",
            retryAfterMs: ttl * 1000
        };
    }

    return { allowed: true };
}

export async function recordFailedAuthAttempt(storageKey: string): Promise<void> {
    if (!config.default.PASSWORD_PROTECTION_ENABLED) {
        return;
    }

    const attemptsKey = getAuthAttemptsKey(storageKey);
    const lockoutKey = getAuthLockoutKey(storageKey);

    const currentAttempts = await redis.incr(attemptsKey);

    if (currentAttempts === 1) {
        await redis.expire(attemptsKey, 3600);
    }

    if (currentAttempts >= config.default.MAX_AUTH_ATTEMPTS) {
        await redis.setex(
            lockoutKey,
            Math.ceil(config.default.AUTH_LOCKOUT_DURATION_MS / 1000),
            "locked"
        );
        await redis.del(attemptsKey);
    }
}

export async function clearAuthAttempts(storageKey: string): Promise<void> {
    if (!config.default.PASSWORD_PROTECTION_ENABLED) {
        return;
    }

    const attemptsKey = getAuthAttemptsKey(storageKey);
    const lockoutKey = getAuthLockoutKey(storageKey);

    await redis.del(attemptsKey);
    await redis.del(lockoutKey);
}
