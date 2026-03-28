import { pool } from "../db/index.js";
import type { StorageService } from "../storage/storage.interface.js";

export interface CleanupResult {
    expiredFiles: number;
    deletedFiles: number;
    errors: string[];
}

export async function cleanupExpiredFiles(
    storage: StorageService
): Promise<CleanupResult> {
    const result: CleanupResult = {
        expiredFiles: 0,
        deletedFiles: 0,
        errors: []
    };

    const client = await pool.connect();

    try {
        const selectResult = await client.query(
            `SELECT id, storage_key FROM files 
             WHERE expires_at <= NOW() AND removed = FALSE`
        );

        const rows = selectResult.rows;
        result.expiredFiles = rows.length;

        for (const file of rows) {
            try {
                await storage.delete(file.storage_key);
                result.deletedFiles++;

                await client.query(
                    `UPDATE files SET removed = TRUE WHERE id = $1`,
                    [file.id]
                );
            } catch (err) {
                result.errors.push(`Failed to delete: ${file.storage_key}`);
                console.error(`Failed to delete file ${file.storage_key}:`, err);
            }
        }

        console.log(
            `Cleanup complete: ${result.deletedFiles}/${result.expiredFiles} files deleted`
        );

        return result;
    } finally {
        client.release();
    }
}

export function startCleanupScheduler(
    storage: StorageService,
    intervalHours: number = 24
): NodeJS.Timeout {
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`Cleanup scheduler started (every ${intervalHours} hours)`);

    return setInterval(async () => {
        try {
            console.log("Running scheduled cleanup...");
            await cleanupExpiredFiles(storage);
        } catch (err) {
            console.error("Scheduled cleanup failed:", err);
        }
    }, intervalMs);
}

/*
 * PRODUCTION ARCHITECTURE NOTE:
 * 
 * The setInterval scheduler above is fine for development/simple deployments.
 * For production, you should use a proper background worker with BullMQ:
 * 
 * ┌─────────────┐       ┌─────────┐       ┌─────────────────┐
 * │  API Server │  ──→  │  Redis  │  ──→  │ Background Worker│
 * └─────────────┘  add   └─────────┘  pop   │ (cleanup job)   │
 *                                          └─────────────────┘
 * 
 * Benefits of BullMQ:
 * - Survives server restarts
 * - Automatic retries on failure
 * - Job persistence (survives Redis restarts)
 * - Multiple worker processes
 * - Rate limiting, priorities, etc.
 * 
 * Example BullMQ setup (future):
 * 
 * import { Queue, Worker } from 'bullmq';
 * 
 * const cleanupQueue = new Queue('cleanup', { connection: redis });
 * 
 * // API server adds job:
 * await cleanupQueue.add('cleanup', {}, { repeat: { every: 24 * 60 * 60 * 1000 }});
 * 
 * // Worker processes:
 * const worker = new Worker('cleanup', async () => {
 *     await cleanupExpiredFiles(storage);
 * });
 */
