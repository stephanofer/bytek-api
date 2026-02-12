import type { Hono } from "hono";

import type { Database } from "@db";

/**
 * Central type definitions for the Hono application.
 *
 * AppEnv defines the shape of the environment available
 * in every route handler via `c.env` and `c.var`.
 */
export interface AppEnv {
  Bindings: CloudflareBindings & {
    JWT_SECRET: string;
  };
  Variables: {
    db: Database;
    userId: number;
    userEmail: string;
  };
}

/**
 * Utility type for creating sub-routers (controllers)
 * that share the same environment shape as the main app.
 */
export type AppRouter = Hono<AppEnv>;
