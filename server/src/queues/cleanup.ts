import { Queue, Worker, type Job } from "bullmq";
import { redis } from "../lib/redis.js";
import { cleanupExpiredFiles } from "../services/cleanup.js";
import { LocalDiskStorage } from "../storage/local-disk.js";
import type { StorageService } from "../storage/storage.interface.js";
import * as config from "../../config/config.json" with { type: "json" };

export const cleanupQueue = new Queue("cleanup", {
    connection: redis,
    defaultJobOptions: {
        removeOnComplete: {
            count: 100
        },
        removeOnFail: {
            count: 50
        }
    }
});

export async function scheduleCleanup(): Promise<void> {
    const existingJobs = await cleanupQueue.getRepeatableJobs();

    if (existingJobs.length === 0) {
        const intervalMs = config.default.CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;

        await cleanupQueue.add("cleanup", {}, {
            repeat: {
                every: intervalMs
            },
            jobId: "scheduled-cleanup"
        });

        console.log(
            `Cleanup scheduled to run every ${config.default.CLEANUP_INTERVAL_HOURS} hours`
        );
    } else {
        console.log("Cleanup job already scheduled");
    }
}

export function createCleanupWorker(
    storage: StorageService = new LocalDiskStorage()
): Worker {
    const worker = new Worker(
        "cleanup",
        async (job: Job) => {
            console.log(`[Cleanup] Job ${job.id} started at ${new Date().toISOString()}`);

            const result = await cleanupExpiredFiles(storage);

            console.log(
                `[Cleanup] Job ${job.id} completed: ${result.deletedFiles}/${result.expiredFiles} files deleted`
            );

            if (result.errors.length > 0) {
                console.warn(`[Cleanup] Job ${job.id} had ${result.errors.length} errors`);
            }

            return {
                expiredFiles: result.expiredFiles,
                deletedFiles: result.deletedFiles,
                errors: result.errors
            };
        },
        {
            connection: redis,
            concurrency: 1,
            limiter: {
                max: 1,
                duration: 60 * 60 * 1000
            }
        }
    );

    worker.on("completed", (job, result) => {
        console.log(`[Cleanup] Job ${job.id} completed with result:`, result);
    });

    worker.on("failed", (job, err) => {
        console.error(`[Cleanup] Job ${job?.id} failed:`, err.message);
    });

    worker.on("error", (err) => {
        console.error("[Cleanup] Worker error:", err);
    });

    return worker;
}

export async function stopCleanupWorker(worker: Worker): Promise<void> {
    await worker.close();
    console.log("Cleanup worker stopped");
}
