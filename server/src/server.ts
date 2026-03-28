import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import * as config from "../config/config.json" with { type: "json" };
import { LocalDiskStorage } from "./storage/index.js";
import type { StorageService } from "./storage/index.js";
import { pool, initializeDatabase } from "./db/index.js";
import { validateFile, calculateExpiry, getExpiryInfo, cleanupExpiredFiles } from "./services/index.js";
import { scheduleCleanup, createCleanupWorker } from "./queues/cleanup.js";
import type { Worker } from "bullmq";

const app = Fastify();
const storage: StorageService = new LocalDiskStorage();

function sanitizeFilename(filename: string): string {
    return filename
        .replace(/["\n\r\t]/g, "_")
        .slice(0, 255);
}

function isValidStorageKey(key: string): boolean {
    const validPattern = /^[\w-]+\.[\w]+$/;
    return validPattern.test(key) && key.length <= 100;
}

app.get("/", async () => {
    return { status: "ok" };
});

app.post("/", async (request, reply) => {
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

    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO files (storage_key, original_name, mime, size, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [storageKey, data.filename, mime, buffer.length, expiresAt]
        );
    } finally {
        client.release();
    }

    return {
        url: result.url,
        expires_at: expiresAt.toISOString(),
        expires_in_hours: expiryInfo.expiryHours
    };
});

app.get<{ Params: { id: string } }>("/files/:id", async (request, reply) => {
    const fileId = request.params.id;

    if (!isValidStorageKey(fileId)) {
        return reply.status(400).send("Invalid file ID");
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

        let fileBuffer: Buffer;
        try {
            fileBuffer = await storage.get(fileId);
        } catch (err) {
            console.error("Failed to read file from storage:", err);
            return reply.status(500).send("File storage error");
        }

        reply.header("Content-Type", file.mime || "application/octet-stream");
        reply.header("Content-Disposition", `attachment; filename="${sanitizeFilename(file.original_name)}"`);
        return reply.send(fileBuffer);
    } finally {
        client.release();
    }
});

const start = async () => {
    await initializeDatabase();
    await app.register(cors);
    await app.register(fastifyMultipart);

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
        process.exit(0);
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
};

start();
