import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import * as config from "../../config/config.json" with { type: "json" };
import type { StorageService, StoredFile } from "./storage.interface.js";

export class LocalDiskStorage implements StorageService {
    async save(filename: string, data: Buffer): Promise<StoredFile> {
        const uploadDir = config.default.UPLOAD_DESTINATION;
        await fs.mkdir(uploadDir, { recursive: true });

        const ext = path.extname(filename);
        const uuidParts = randomUUID().split("-");
        const uuid = uuidParts[0] ?? randomUUID().replace(/-/g, "").slice(0, 8);
        const storedName = `${uuid}${ext}`;
        const filePath = path.join(uploadDir, storedName);

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
