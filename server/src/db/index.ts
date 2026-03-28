import pg from "pg";
import * as config from "../../config/config.json" with { type: "json" };

const { Pool } = pg;

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL ?? config.default.DATABASE_URL
});

pool.on("error", (err) => {
    console.error("Unexpected database error:", err);
});

export async function initializeDatabase(): Promise<void> {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS files (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                storage_key TEXT NOT NULL UNIQUE,
                original_name TEXT NOT NULL,
                mime TEXT,
                size BIGINT NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL,
                removed BOOLEAN NOT NULL DEFAULT FALSE
            )
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_files_storage_key ON files(storage_key)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_files_expires_at ON files(expires_at)
        `);

        console.log("Database schema initialized");
    } finally {
        client.release();
    }
}
