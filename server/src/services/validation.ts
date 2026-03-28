import * as config from "../../config/config.json" with { type: "json" };
import { fileTypeFromBuffer } from "file-type";

export interface ValidationResult {
    valid: boolean;
    error?: string;
    detectedMime?: string;
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

export async function validateMagicBytes(
    buffer: Buffer,
    reportedMime: string
): Promise<ValidationResult> {
    try {
        const detected = await fileTypeFromBuffer(buffer);

        if (!detected) {
            return { valid: true, detectedMime: reportedMime };
        }

        const detectedMime = detected.mime;

        if (config.default.MIME_BLACKLIST.includes(detectedMime)) {
            return {
                valid: false,
                error: "File type not allowed",
                detectedMime
            };
        }

        if (reportedMime !== detectedMime) {
            console.warn(
                `MIME mismatch: reported=${reportedMime}, detected=${detectedMime}`
            );
        }

        return { valid: true, detectedMime };
    } catch (err) {
        console.error("Magic byte detection failed:", err);
        return { valid: true, detectedMime: reportedMime };
    }
}

export async function validateFile(
    buffer: Buffer,
    reportedMime: string,
    filename: string
): Promise<ValidationResult> {
    const sizeResult = validateFileSize(buffer.length);
    if (!sizeResult.valid) return sizeResult;

    const mimeResult = validateMimeType(reportedMime);
    if (!mimeResult.valid) return mimeResult;

    const extResult = validateExtension(filename);
    if (!extResult.valid) return extResult;

    const magicResult = await validateMagicBytes(buffer, reportedMime);
    if (!magicResult.valid) return magicResult;

    return { valid: true };
}
