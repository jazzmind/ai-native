// Backwards compatibility — all existing API routes continue to work
// Note: All functions are now async (migrated from sync SQLite to async Postgres/Drizzle)
export * from './db/index';
