export interface StoredFile {
    path: string;
    url: string;
}

export interface StorageService {
    save(filename: string, data: Buffer): Promise<StoredFile>;
    delete(path: string): Promise<void>;
}
