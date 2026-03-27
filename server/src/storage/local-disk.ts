import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import type { StorageService, StoredFile } from "./storage.interface.js";

const UPLOAD_DIR = "/tmp/dropifi-uploads";

export class LocalDiskStorage implements StorageService {
    async save(filename: string, data: Buffer): Promise<StoredFile> {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });

        const ext = path.extname(filename);
        const storedName = `${randomUUID()}${ext}`;
        const filePath = path.join(UPLOAD_DIR, storedName);

        await fs.writeFile(filePath, data);

        return {
            path: filePath,
            url: `/files/${storedName}`
        };
    }

    async delete(storedPath: string): Promise<void> {
        await fs.unlink(storedPath);
    }
}
