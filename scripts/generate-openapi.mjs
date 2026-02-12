/**
 * Generates a static openapi.json file by fetching the /openapi endpoint.
 *
 * Usage:
 *   pnpm openapi:generate
 *
 * This starts a local Wrangler dev server, fetches the OpenAPI spec,
 * saves it to docs/openapi.json, and shuts down.
 *
 * Import this file into APIDOG (or any API client) to get all endpoints.
 * Re-run this script whenever you add/modify endpoints.
 */

import { execSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUTPUT_PATH = "docs/openapi.json";
const PORT = 8686; // Different port to avoid conflicts with dev server
const SERVER_URL = `http://localhost:${PORT}`;

async function waitForServer(url, maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${url}/health`);
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server failed to start");
}

async function main() {
  console.log("🔄 Starting temporary server to generate OpenAPI spec...\n");

  // Start wrangler on a separate port
  const server = spawn("pnpm", ["wrangler", "dev", "--port", String(PORT)], {
    stdio: "pipe",
    detached: false,
  });

  try {
    await waitForServer(SERVER_URL);

    // Fetch the OpenAPI spec
    const res = await fetch(`${SERVER_URL}/openapi`);
    if (!res.ok) throw new Error(`Failed to fetch OpenAPI spec: ${res.status}`);

    const spec = await res.json();

    // Ensure output directory exists
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

    // Write formatted JSON
    writeFileSync(OUTPUT_PATH, JSON.stringify(spec, null, 2) + "\n");

    console.log(`✅ OpenAPI spec saved to ${OUTPUT_PATH}`);
    console.log(`   Endpoints found: ${Object.keys(spec.paths || {}).length}`);
    console.log(`\n💡 Import this file into APIDOG to sync your endpoints.`);
  } finally {
    // Kill the server
    server.kill("SIGTERM");
    // Also kill any child processes (wrangler spawns workerd)
    try {
      execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null`, { stdio: "ignore" });
    } catch {
      // Port might already be free
    }
  }
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});
