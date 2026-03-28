import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import * as fs from "fs/promises";
import * as config from "../config/config.json" with { type: "json" };
import { LocalDiskStorage } from "./storage/index.js";
import type { StorageService } from "./storage/index.js";
import { pool, initializeDatabase } from "./db/index.js";
import { validateFile } from "./services/index.js";

const app = Fastify();
const storage: StorageService = new LocalDiskStorage();

app.get("/", async () => {
    return { status: "ok" };
});

app.post("/", async (request, reply) => {
    const data = await request.file();

    if (!data) {
        return reply.status(400).send("No file provided");
    }

    const buffer = await data.toBuffer();

    const validation = validateFile(
        buffer.length,
        data.mimetype,
        data.filename
    );

    if (!validation.valid) {
        return reply.status(400).send(validation.error);
    }

    const result = await storage.save(data.filename, buffer);

    const storageKey = result.url.split("/").pop()!;

    const expiryHours = config.default.DEFAULT_EXPIRY_HOURS;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    const client = await pool.connect();
    try {
        await client.query(
            `INSERT INTO files (storage_key, original_name, mime, size, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [storageKey, data.filename, data.mimetype, buffer.length, expiresAt]
        );
    } finally {
        client.release();
    }

    return { url: result.url };
});

app.get<{ Params: { id: string } }>("/files/:id", async (request, reply) => {
    const fileId = request.params.id;
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
        const filePath = `${config.default.UPLOAD_DESTINATION}/${fileId}`;
        const fileBuffer = await fs.readFile(filePath);

        reply.header("Content-Disposition", `attachment; filename="${file.original_name}"`);
        return reply.send(fileBuffer);
    } finally {
        client.release();
    }
});

const start = async () => {
    await initializeDatabase();
    await app.register(cors);
    await app.register(fastifyMultipart);

    await app.listen({ port: config.default.PORT });
    console.log(`Server running at http://localhost:${config.default.PORT}`);
};

start();
