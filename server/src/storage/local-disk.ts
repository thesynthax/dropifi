import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import * as config from "../../config/config.json" with { type: "json" };
import type { StorageService, StoredFile } from "./storage.interface.js";

export class LocalDiskStorage implements StorageService {
    private uploadDir: string;

    constructor() {
        this.uploadDir = config.default.UPLOAD_DESTINATION;
    }

    private validateStorageKey(storageKey: string): void {
        if (!storageKey || storageKey.length > 100) {
            throw new Error("Invalid storage key: too long or empty");
        }

        if (storageKey.includes("..") || storageKey.includes("/") || storageKey.includes("\\")) {
            throw new Error("Invalid storage key: path traversal detected");
        }

        if (/^[.\s]/.test(storageKey)) {
            throw new Error("Invalid storage key: cannot start with dot or space");
        }
    }

    private getFilePath(storageKey: string): string {
        this.validateStorageKey(storageKey);
        return path.join(this.uploadDir, storageKey);
    }

    async save(filename: string, data: Buffer): Promise<StoredFile> {
        await fs.mkdir(this.uploadDir, { recursive: true });

        const ext = path.extname(filename);
        const uuid = randomUUID().split("-")[0];
        const storageKey = `${uuid}${ext}`;
        const filePath = this.getFilePath(storageKey);

        await fs.writeFile(filePath, data);

        return {
            storageKey,
            url: `/files/${storageKey}`
        };
    }

    async delete(storageKey: string): Promise<void> {
        const filePath = this.getFilePath(storageKey);
        await fs.unlink(filePath);
    }

    async get(storageKey: string): Promise<Buffer> {
        const filePath = this.getFilePath(storageKey);
        return await fs.readFile(filePath);
    }
}
