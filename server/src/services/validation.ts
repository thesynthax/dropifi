import * as config from "../../config/config.json" with { type: "json" };

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export function validateFileSize(size: number): ValidationResult {
    if (size <= 0) {
        return { valid: false, error: "File is empty" };
    }

    if (size > config.default.MAX_FILE_SIZE) {
        return {
            valid: false,
            error: `File too large. Maximum size is ${Math.round(config.default.MAX_FILE_SIZE / 1024 / 1024)}MB`
        };
    }

    return { valid: true };
}

export function validateMimeType(mimeType: string): ValidationResult {
    const mime = mimeType.toLowerCase();

    if (config.default.MIME_BLACKLIST.includes(mime)) {
        return { valid: false, error: "File type not allowed" };
    }

    return { valid: true };
}

export function validateExtension(filename: string): ValidationResult {
    const parts = filename.split(".");
    const extension = parts.length > 1 ? parts[parts.length - 1] ?? "" : "";

    if (extension.length > config.default.MAX_EXT_LENGTH) {
        return {
            valid: false,
            error: `Extension too long. Maximum ${config.default.MAX_EXT_LENGTH} characters`
        };
    }

    return { valid: true };
}

export function validateFile(
    size: number,
    mimeType: string,
    filename: string
): ValidationResult {
    const sizeResult = validateFileSize(size);
    if (!sizeResult.valid) return sizeResult;

    const mimeResult = validateMimeType(mimeType);
    if (!mimeResult.valid) return mimeResult;

    const extResult = validateExtension(filename);
    if (!extResult.valid) return extResult;

    return { valid: true };
}
