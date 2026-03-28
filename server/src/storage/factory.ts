import * as config from "../../config/config.json" with { type: "json" };
import { LocalDiskStorage } from "./local-disk.js";
import { S3Storage } from "./s3-storage.js";
import type { StorageService } from "./storage.interface.js";

export function createStorage(): StorageService {
    const storageType = config.default.STORAGE_TYPE?.toLowerCase() ?? "local";

    switch (storageType) {
        case "s3":
            console.log("Using S3 storage");
            return new S3Storage();

        case "minio":
            console.log("Using MinIO storage");
            return new S3Storage();

        case "local":
        default:
            console.log("Using local disk storage");
            return new LocalDiskStorage();
    }
}
