import { Redis } from "ioredis";
import * as config from "../../config/config.json" with { type: "json" };

const redisUrl = process.env.REDIS_URL ?? config.default.REDIS_URL;

export const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null
});

redis.on("connect", () => {
    console.log("Connected to Redis");
});

redis.on("error", (err: Error) => {
    console.error("Redis connection error:", err);
});

redis.on("close", () => {
    console.log("Redis connection closed");
});
