export interface StoredFile {
    storageKey: string;
    url: string;
}

export interface StorageService {
    save(filename: string, data: Buffer): Promise<StoredFile>;
    delete(storageKey: string): Promise<void>;
    get(storageKey: string): Promise<Buffer>;
}
