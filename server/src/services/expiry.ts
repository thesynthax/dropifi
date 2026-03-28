import * as config from "../../config/config.json" with { type: "json" };

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function calculateExpiryHours(fileSize: number, userSpecifiedHours?: number): number {
    const minAgeHours = config.default.MIN_AGE * 24;
    const maxAgeHours = config.default.MAX_AGE * 24;

    let expiryHours: number;

    if (userSpecifiedHours !== undefined && userSpecifiedHours > 0) {
        expiryHours = userSpecifiedHours;
    } else {
        const sizeRatio = fileSize / config.default.MAX_FILE_SIZE;
        const cubicValue = Math.pow(sizeRatio - 1, 3);
        expiryHours = Math.floor(
            minAgeHours - (maxAgeHours - minAgeHours) * cubicValue
        );
    }

    return clamp(expiryHours, minAgeHours, maxAgeHours);
}

export function calculateExpiry(
    fileSize: number,
    userSpecifiedHours?: number
): Date {
    const expiryHours = calculateExpiryHours(fileSize, userSpecifiedHours);
    return new Date(Date.now() + expiryHours * 60 * 60 * 1000);
}

export function getExpiryInfo(fileSize: number, userSpecifiedHours?: number): {
    expiryHours: number;
    expiresAt: Date;
} {
    const expiryHours = calculateExpiryHours(fileSize, userSpecifiedHours);
    return {
        expiryHours,
        expiresAt: new Date(Date.now() + expiryHours * 60 * 60 * 1000)
    };
}
