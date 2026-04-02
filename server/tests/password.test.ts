import { describe, it, after } from "node:test";
import assert from "node:assert";
import {
    validatePassword,
    hashPassword,
    verifyPassword,
    checkAuthLockout,
    recordFailedAuthAttempt,
    clearAuthAttempts,
    extractBasicAuthPassword
} from "../src/services/password.js";
import { redis } from "../src/lib/redis.js";

describe("Password Service", () => {
    const testKey = `test:${Date.now()}`;

    after(async () => {
        await redis.del(`dropifi:auth:lockout:${testKey}`);
        await redis.del(`dropifi:auth:attempts:${testKey}`);
    });

    describe("validatePassword", () => {
        it("returns valid for empty password", async () => {
            const result = await validatePassword("");
            assert.strictEqual(result.valid, true);
        });

        it("returns valid for password meeting minimum length", async () => {
            const result = await validatePassword("1234");
            assert.strictEqual(result.valid, true);
        });

        it("returns invalid for password below minimum length", async () => {
            const result = await validatePassword("123");
            assert.strictEqual(result.valid, false);
            assert.ok(result.error?.includes("4 characters"));
        });
    });

    describe("hashPassword", () => {
        it("returns null for empty password", async () => {
            const result = await hashPassword("");
            assert.strictEqual(result, null);
        });

        it("returns a bcrypt hash for valid password", async () => {
            const result = await hashPassword("test123");
            assert.ok(result);
            assert.ok(result?.startsWith("$2"));
        });

        it("returns different hashes for same password", async () => {
            const hash1 = await hashPassword("test123");
            const hash2 = await hashPassword("test123");
            assert.notStrictEqual(hash1, hash2);
        });
    });

    describe("verifyPassword", () => {
        it("returns true for correct password", async () => {
            const hash = await hashPassword("correctpassword");
            const result = await verifyPassword("correctpassword", hash);
            assert.strictEqual(result, true);
        });

        it("returns false for incorrect password", async () => {
            const hash = await hashPassword("correctpassword");
            const result = await verifyPassword("wrongpassword", hash);
            assert.strictEqual(result, false);
        });

        it("returns false for null hash", async () => {
            const result = await verifyPassword("anypassword", null);
            assert.strictEqual(result, false);
        });

        it("returns false for empty password with valid hash", async () => {
            const hash = await hashPassword("somepassword");
            const result = await verifyPassword("", hash);
            assert.strictEqual(result, false);
        });
    });

    describe("checkAuthLockout", () => {
        it("returns allowed when no lockout exists", async () => {
            const result = await checkAuthLockout(testKey);
            assert.strictEqual(result.allowed, true);
        });

        it("returns not allowed with retry info when locked out", async () => {
            await redis.setex(`dropifi:auth:lockout:${testKey}`, 60, "locked");
            const result = await checkAuthLockout(testKey);
            assert.strictEqual(result.allowed, false);
            assert.ok(result.retryAfterMs);
            assert.ok(result.error?.includes("locked"));
            await redis.del(`dropifi:auth:lockout:${testKey}`);
        });
    });

    describe("recordFailedAuthAttempt", () => {
        it("increments attempt count", async () => {
            await redis.del(`dropifi:auth:attempts:${testKey}`);
            
            await recordFailedAuthAttempt(testKey);
            const attempts1 = await redis.get(`dropifi:auth:attempts:${testKey}`);
            assert.strictEqual(attempts1, "1");

            await recordFailedAuthAttempt(testKey);
            const attempts2 = await redis.get(`dropifi:auth:attempts:${testKey}`);
            assert.strictEqual(attempts2, "2");

            await redis.del(`dropifi:auth:attempts:${testKey}`);
        });

        it("triggers lockout after max attempts", async () => {
            await redis.del(`dropifi:auth:attempts:${testKey}`);
            await redis.del(`dropifi:auth:lockout:${testKey}`);

            for (let i = 0; i < 5; i++) {
                await recordFailedAuthAttempt(testKey);
            }

            const lockout = await redis.get(`dropifi:auth:lockout:${testKey}`);
            assert.strictEqual(lockout, "locked");

            await redis.del(`dropifi:auth:attempts:${testKey}`);
            await redis.del(`dropifi:auth:lockout:${testKey}`);
        });
    });

    describe("clearAuthAttempts", () => {
        it("clears both attempts and lockout", async () => {
            await redis.setex(`dropifi:auth:attempts:${testKey}`, 3600, "3");
            await redis.setex(`dropifi:auth:lockout:${testKey}`, 300, "locked");

            await clearAuthAttempts(testKey);

            const attempts = await redis.get(`dropifi:auth:attempts:${testKey}`);
            const lockout = await redis.get(`dropifi:auth:lockout:${testKey}`);
            assert.strictEqual(attempts, null);
            assert.strictEqual(lockout, null);
        });
    });
});

describe("extractBasicAuthPassword", () => {
    it("extracts password from Basic Auth header", () => {
        const base64 = Buffer.from(":secret123").toString("base64");
        const result = extractBasicAuthPassword(`Basic ${base64}`);
        assert.strictEqual(result, "secret123");
    });

    it("handles password with colons", () => {
        const base64 = Buffer.from(":pass:word:w:ith:colons").toString("base64");
        const result = extractBasicAuthPassword(`Basic ${base64}`);
        assert.strictEqual(result, "pass:word:w:ith:colons");
    });

    it("returns undefined for missing header", () => {
        const result = extractBasicAuthPassword(undefined);
        assert.strictEqual(result, undefined);
    });

    it("returns undefined for non-Basic auth", () => {
        const result = extractBasicAuthPassword("Bearer sometoken");
        assert.strictEqual(result, undefined);
    });

    it("returns undefined for malformed base64", () => {
        const result = extractBasicAuthPassword("Basic invalid!!!base64");
        assert.strictEqual(result, undefined);
    });
});
