import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import * as config from "../config/config.json" with { type: "json" };
import { LocalDiskStorage } from "./storage/index.js";
import type { StorageService } from "./storage/index.js";

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
    const result = await storage.save(data.filename, buffer);

    console.log("File saved:", {
        original: data.filename,
        stored: result.url
    });

    return { url: result.url };
});

const start = async () => {
    await app.register(cors);
    await app.register(fastifyMultipart);

    await app.listen({ port: config.default.PORT });
    console.log(`Server is running at http://localhost:${config.default.PORT}`);
};

start();
