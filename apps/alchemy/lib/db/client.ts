import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and start the local Postgres via `docker compose up -d`.",
  );
}

const isProduction = process.env.NODE_ENV === "production";

const client = postgres(connectionString, {
  max: isProduction ? 10 : 5,
  prepare: false,
});

export const db = drizzle(client, { schema });
export { schema };
