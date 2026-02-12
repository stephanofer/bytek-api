/**
 * Test setup file for Cloudflare Workers Vitest pool.
 *
 * Runs before each test file.
 * Applies D1 migrations so the database schema is ready for tests.
 */

import { env, applyD1Migrations } from "cloudflare:test";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
