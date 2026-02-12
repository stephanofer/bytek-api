import {
  defineWorkersConfig,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersConfig(async () => {
  const migrationsPath = path.join(__dirname, "drizzle", "migrations");

  let migrations: D1Migration[] = [];
  try {
    migrations = await readD1Migrations(migrationsPath);
  } catch {
    // No migrations yet — that's fine during initial setup
  }

  return {
    test: {
      setupFiles: ["./tests/setup.ts"],
      globals: true,
      poolOptions: {
        workers: {
          wrangler: {
            configPath: "./wrangler.jsonc",
          },
          miniflare: {
            bindings: {
              JWT_SECRET: "test-secret-key-for-vitest",
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
    resolve: {
      alias: {
        "@app": path.resolve(__dirname, "src/index"),
        "@controllers": path.resolve(__dirname, "src/controllers"),
        "@services": path.resolve(__dirname, "src/services"),
        "@schemas": path.resolve(__dirname, "src/schemas"),
        "@models": path.resolve(__dirname, "src/models"),
        "@middlewares": path.resolve(__dirname, "src/middlewares"),
        "@core": path.resolve(__dirname, "src/core"),
        "@db": path.resolve(__dirname, "src/db"),
        "@exceptions": path.resolve(__dirname, "src/exceptions"),
        "@crons": path.resolve(__dirname, "src/crons"),
      },
    },
  };
});
