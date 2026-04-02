import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import * as config from "../config/config.json" with { type: "json" };
import { createStorage } from "./storage/index.js";
import type { StorageService } from "./storage/index.js";
import { pool, initializeDatabase } from "./db/index.js";
import { redis } from "./lib/redis.js";
import {
    validateFile,
    calculateExpiry,
    getExpiryInfo,
    cleanupExpiredFiles,
    checkRateLimit,
    getClientIdentifier,
    hashPassword,
    verifyPassword,
    checkAuthLockout,
    recordFailedAuthAttempt,
    clearAuthAttempts,
    extractBasicAuthPassword
} from "./services/index.js";
import { scheduleCleanup, createCleanupWorker } from "./queues/cleanup.js";
import type { Worker } from "bullmq";

const app = Fastify({
    bodyLimit: config.default.MAX_FILE_SIZE,
    trustProxy: config.default.TRUST_PROXY
});

app.setErrorHandler((error, _request, reply) => {
    console.error("Request error:", error);
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const err = error as Error & { statusCode?: number };
    reply.status(statusCode).send({
        error: err.name || "Internal Server Error",
        message: err.message
    });
});

const storage: StorageService = createStorage();

function sanitizeFilename(filename: string): string {
    return filename
        .replace(/["\n\r\t]/g, "_")
        .slice(0, 255);
}

function isValidStorageKey(key: string): boolean {
    const validPattern = /^[\w-]+\.[\w]+$/;
    return validPattern.test(key) && key.length <= 100;
}

const INLINE_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    "image/x-icon",
    "application/pdf",
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "application/javascript",
    "application/json",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "video/mp4",
    "video/webm",
    "video/ogg"
]);

function isInlineViewable(mimeType: string | null): boolean {
    if (!mimeType) return false;
    return INLINE_MIME_TYPES.has(mimeType.toLowerCase());
}

app.get("/", async () => {
    return { status: "ok" };
});

app.post("/", async (request, reply) => {
    const clientId = getClientIdentifier({
        ip: request.ip,
        headers: request.headers as Record<string, string | string[]>
    });

    const rateLimit = await checkRateLimit(clientId);

    reply.header("X-RateLimit-Limit", rateLimit.limit);
    reply.header("X-RateLimit-Remaining", rateLimit.remaining);
    reply.header("X-RateLimit-Reset", rateLimit.resetAt.toISOString());

    if (!rateLimit.allowed) {
        if (rateLimit.retryAfterMs) {
            reply.header("Retry-After", Math.ceil(rateLimit.retryAfterMs / 1000));
        }
        return reply.status(429).send({
            error: "Rate limit exceeded",
            message: `Too many requests. Try again in ${Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)} seconds`,
            limit: rateLimit.limit,
            windowMs: config.default.RATE_LIMIT_WINDOW_MS
        });
    }

    const data = await request.file();

    if (!data) {
        return reply.status(400).send("No file provided");
    }

    const buffer = await data.toBuffer();
    const reportedMime = data.mimetype;

    const validation = await validateFile(
        buffer,
        reportedMime,
        data.filename
    );

    if (!validation.valid) {
        return reply.status(400).send(validation.error);
    }

    const result = await storage.save(data.filename, buffer);

    const storageKey = result.storageKey;
    const mime = validation.detectedMime ?? reportedMime;

    let userSpecifiedHours: number | undefined;
    const expiresFields = data.fields?.["expires"];

    if (expiresFields) {
        const fieldArray = Array.isArray(expiresFields) ? expiresFields : [expiresFields];
        const field = fieldArray[0];
        if (field && "value" in field) {
            const parsed = parseInt(String(field.value));
            if (!isNaN(parsed) && parsed > 0) {
                userSpecifiedHours = parsed;
            }
        }
    }

    const expiresAt = calculateExpiry(buffer.length, userSpecifiedHours);
    const expiryInfo = getExpiryInfo(buffer.length, userSpecifiedHours);

    let passwordHash: string | null = null;
    const passwordFields = data.fields?.["pass"];

    if (passwordFields) {
        const fieldArray = Array.isArray(passwordFields) ? passwordFields : [passwordFields];
        const field = fieldArray[0];
        if (field && "value" in field) {
            const passwordValue = String(field.value).trim();
            if (passwordValue) {
                const passwordValidation = await import("./services/password.js").then(m => m.validatePassword(passwordValue));
                if (!passwordValidation.valid) {
                    return reply.status(400).send(passwordValidation.error);
                }
                passwordHash = await hashPassword(passwordValue);
            }
        }
    }

    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO files (storage_key, original_name, mime, size, expires_at, password_hash)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [storageKey, data.filename, mime, buffer.length, expiresAt, passwordHash]
        );
    } finally {
        client.release();
    }

    const host = request.headers.host ?? `localhost:${config.default.PORT}`;
    const protocol = request.protocol === "https" ? "https" : "http";
    const fullUrl = `${protocol}://${host}${result.url}`;

    if (!passwordHash) {
        reply.header("Content-Type", "text/plain");
        return `Link: ${fullUrl}\nExpires at: ${expiresAt.toISOString()}`;
    }

    reply.header("Content-Type", "text/plain");
    return `Link: ${fullUrl}\nExpires at: ${expiresAt.toISOString()}\n\nPassword protected. Access via:\n  Header: X-Dropifi-Password: <your-password>\n  Basic Auth: Authorization: Basic base64(:<your-password>)\n`;
});

app.get<{ Params: { id: string } }>("/files/:id", async (request, reply) => {
    const fileId = request.params.id;

    if (!isValidStorageKey(fileId)) {
        return reply.status(400).send("Invalid file ID");
    }

    const clientId = getClientIdentifier({
        ip: request.ip,
        headers: request.headers as Record<string, string | string[]>
    });

    const rateLimit = await checkRateLimit(clientId);

    reply.header("X-RateLimit-Limit", rateLimit.limit);
    reply.header("X-RateLimit-Remaining", rateLimit.remaining);
    reply.header("X-RateLimit-Reset", rateLimit.resetAt.toISOString());

    if (!rateLimit.allowed) {
        if (rateLimit.retryAfterMs) {
            reply.header("Retry-After", Math.ceil(rateLimit.retryAfterMs / 1000));
        }
        return reply.status(429).send({
            error: "Rate limit exceeded",
            message: `Too many requests. Try again in ${Math.ceil((rateLimit.retryAfterMs ?? 0) / 1000)} seconds`,
            limit: rateLimit.limit,
            windowMs: config.default.RATE_LIMIT_WINDOW_MS
        });
    }

    const authLockout = await checkAuthLockout(fileId);
    if (!authLockout.allowed) {
        if (authLockout.retryAfterMs) {
            reply.header("Retry-After", Math.ceil(authLockout.retryAfterMs / 1000));
        }
        return reply.status(429).send({
            error: "File temporarily locked",
            message: authLockout.error,
            retryAfterMs: authLockout.retryAfterMs
        });
    }

    const client = await pool.connect();

    try {
        const result = await client.query(
            `SELECT * FROM files WHERE storage_key = $1 AND removed = FALSE`,
            [fileId]
        );

        if (result.rows.length === 0) {
            return reply.status(404).send("File not found");
        }

        const file = result.rows[0];
        const passwordHash = file.password_hash as string | null;

        if (new Date(file.expires_at) < new Date()) {
            return reply.status(410).send("File has expired");
        }

        if (passwordHash) {
            const customPassword = request.headers["x-dropifi-password"] as string | undefined;
            const basicAuthPassword = extractBasicAuthPassword(request.headers.authorization);
            const providedPassword = customPassword ?? basicAuthPassword;

            if (!providedPassword) {
                reply.header("WWW-Authenticate", "Basic realm=\"Dropifi\"");
                reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
                reply.header("Pragma", "no-cache");
                reply.header("Content-Type", "application/json");
                return reply.status(401).send(JSON.stringify({
                    error: "Password required",
                    message: "This file is password protected. Provide password via X-Dropifi-Password header or Basic Auth."
                }));
            }

            const isValid = await verifyPassword(providedPassword, passwordHash);

            if (!isValid) {
                await recordFailedAuthAttempt(fileId);
                reply.header("WWW-Authenticate", "Basic realm=\"Dropifi\"");
                reply.header("Cache-Control", "no-store, no-cache, must-revalidate");
                reply.header("Pragma", "no-cache");
                reply.header("Content-Type", "application/json");
                return reply.status(401).send(JSON.stringify({
                    error: "Invalid password",
                    message: "The provided password is incorrect."
                }));
            }

            await clearAuthAttempts(fileId);
        }

        let fileBuffer: Buffer;
        try {
            fileBuffer = await storage.get(fileId);
        } catch (err) {
            console.error("Failed to read file from storage:", err);
            return reply.status(500).send("File storage error");
        }

        reply.header("Content-Type", file.mime || "application/octet-stream");
        const disposition = isInlineViewable(file.mime)
            ? `inline; filename="${sanitizeFilename(file.original_name)}"`
            : `attachment; filename="${sanitizeFilename(file.original_name)}"`;
        reply.header("Content-Disposition", disposition);

        if (passwordHash) {
            reply.header("Cache-Control", "private, max-age=300");
        }

        return reply.send(fileBuffer);
    } finally {
        client.release();
    }
});

const start = async () => {
    await initializeDatabase();
    await app.register(cors);
    await app.register(fastifyMultipart, {
        limits: {
            fileSize: config.default.MAX_FILE_SIZE
        }
    });

    console.log("Running cleanup on startup...");
    await cleanupExpiredFiles(storage);

    const cleanupWorker: Worker = createCleanupWorker(storage);
    await scheduleCleanup();

    await app.listen({ port: config.default.PORT });
    console.log(`Server running at http://localhost:${config.default.PORT}`);

    const gracefulShutdown = async () => {
        console.log("Shutting down gracefully...");
        await cleanupWorker.close();
        await app.close();
        await pool.end();
        await redis.quit();
        process.exit(0);
    };

    process.on("uncaughtException", (err) => {
        console.error("Uncaught Exception:", err);
        gracefulShutdown();
    });

    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled Rejection:", reason);
    });

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
};

start();
