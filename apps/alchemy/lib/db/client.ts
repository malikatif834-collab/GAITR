import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Lazy Drizzle client. We don't connect or even read DATABASE_URL until
 * the first query. This keeps `next build` happy on platforms (like
 * Vercel) that evaluate server modules before runtime env is fully
 * available.
 */
let cached: PostgresJsDatabase<typeof schema> | undefined;

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    if (!cached) cached = createClient();
    return Reflect.get(cached, prop, receiver);
  },
});

export { schema };

function createClient(): PostgresJsDatabase<typeof schema> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and start the local Postgres via `docker compose up -d` — or set DATABASE_URL in your deployment environment.",
    );
  }
  const isProduction = process.env.NODE_ENV === "production";
  const client = postgres(connectionString, {
    max: isProduction ? 10 : 5,
    prepare: false,
  });
  return drizzle(client, { schema });
}
