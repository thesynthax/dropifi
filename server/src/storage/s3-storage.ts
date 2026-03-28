import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadBucketCommand,
    CreateBucketCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import * as config from "../../config/config.json" with { type: "json" };
import type { StorageService, StoredFile } from "./storage.interface.js";

function validateStorageKey(storageKey: string): void {
    if (!storageKey || storageKey.length > 100) {
        throw new Error("Invalid storage key: too long or empty");
    }

    if (storageKey.includes("..") || storageKey.includes("/")) {
        throw new Error("Invalid storage key: path traversal detected");
    }
}

export class S3Storage implements StorageService {
    private client: S3Client;
    private bucket: string;
    private initialized: boolean = false;

    constructor() {
        this.client = new S3Client({
            endpoint: process.env.S3_ENDPOINT ?? config.default.S3_ENDPOINT,
            region: process.env.S3_REGION ?? config.default.S3_REGION,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY ?? config.default.S3_ACCESS_KEY,
                secretAccessKey: process.env.S3_SECRET_KEY ?? config.default.S3_SECRET_KEY
            },
            forcePathStyle: config.default.S3_FORCE_PATH_STYLE
        });
        this.bucket = process.env.S3_BUCKET ?? config.default.S3_BUCKET;
    }

    private async ensureBucketExists(): Promise<void> {
        if (this.initialized) return;

        try {
            await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
            this.initialized = true;
            console.log(`S3 bucket "${this.bucket}" exists`);
        } catch (err: unknown) {
            const error = err as { name?: string };
            if (error.name === "NotFound" || error.name === "NoSuchBucket") {
                console.log(`Creating S3 bucket "${this.bucket}"...`);
                await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
                this.initialized = true;
                console.log(`S3 bucket "${this.bucket}" created`);
            } else {
                throw err;
            }
        }
    }

    async save(filename: string, data: Buffer): Promise<StoredFile> {
        await this.ensureBucketExists();

        const ext = filename.includes(".") ? filename.split(".").pop() : "";
        const uuid = randomUUID().split("-")[0] ?? randomUUID().replace(/-/g, "").slice(0, 8);
        const storageKey = ext ? `${uuid}.${ext}` : uuid;

        validateStorageKey(storageKey);

        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: storageKey,
                Body: data,
                ContentType: this.getContentType(storageKey)
            })
        );

        return {
            storageKey,
            url: `/files/${storageKey}`
        };
    }

    async get(storageKey: string): Promise<Buffer> {
        validateStorageKey(storageKey);

        const response = await this.client.send(
            new GetObjectCommand({
                Bucket: this.bucket,
                Key: storageKey
            })
        );

        const chunks: Buffer[] = [];
        for await (const chunk of response.Body as AsyncIterable<Buffer>) {
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    }

    async delete(storageKey: string): Promise<void> {
        validateStorageKey(storageKey);

        await this.client.send(
            new DeleteObjectCommand({
                Bucket: this.bucket,
                Key: storageKey
            })
        );
    }

    async getPresignedUrl(storageKey: string, expiresInSeconds: number = 3600): Promise<string> {
        validateStorageKey(storageKey);

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: storageKey
        });

        return await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    }

    private getContentType(storageKey: string): string {
        const parts = storageKey.split(".");
        const ext = parts.length > 1 ? parts[parts.length - 1]?.toLowerCase() : "";
        const mimeTypes: Record<string, string> = {
            "json": "application/json",
            "txt": "text/plain",
            "html": "text/html",
            "css": "text/css",
            "js": "application/javascript",
            "png": "image/png",
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "gif": "image/gif",
            "pdf": "application/pdf",
            "zip": "application/zip",
            "mp4": "video/mp4",
            "mp3": "audio/mpeg",
            "svg": "image/svg+xml"
        };

        return ext ? (mimeTypes[ext] ?? "application/octet-stream") : "application/octet-stream";
    }
}
