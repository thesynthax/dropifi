import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import * as config from "../../config/config.json" with { type: "json" };
import type { StorageService, StoredFile } from "./storage.interface.js";

export class LocalDiskStorage implements StorageService {
    private getUploadDir(): string {
        return config.default.UPLOAD_DESTINATION;
    }

    private getFilePath(storageKey: string): string {
        return path.join(this.getUploadDir(), storageKey);
    }

    async save(filename: string, data: Buffer): Promise<StoredFile> {
        const uploadDir = this.getUploadDir();
        await fs.mkdir(uploadDir, { recursive: true });

        const ext = path.extname(filename);
        const uuidParts = randomUUID().split("-");
        const uuid = uuidParts[0] ?? randomUUID().replace(/-/g, "").slice(0, 8);
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
