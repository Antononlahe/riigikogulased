import { Pool } from "pg";

declare global {
  var __pgPool: Pool | undefined;
}

function makePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({ connectionString, max: 5 });
}

export const pool: Pool = global.__pgPool ?? makePool();
if (process.env.NODE_ENV !== "production") global.__pgPool = pool;
