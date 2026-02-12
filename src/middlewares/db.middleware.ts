import type { Context, Next } from "hono";

import type { AppEnv } from "@core/app-types";
import { createDb } from "@db";

/**
 * Middleware that creates a Drizzle database instance per request
 * and injects it into the context as `c.var.db`.
 *
 * This ensures each request gets its own DB instance
 * backed by the D1 binding from the environment.
 */
export async function dbMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<void> {
  const db = createDb(c.env.DB);
  c.set("db", db);
  await next();
}
