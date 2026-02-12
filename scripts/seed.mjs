/**
 * Seed script to create the initial admin user.
 *
 * Usage:
 *   pnpm db:seed
 *
 * This script hashes the password using PBKDF2 (same as the API)
 * and inserts the admin user via wrangler d1 execute.
 *
 * Modify ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD below
 * before running for the first time.
 */

const ADMIN_EMAIL = "admin@bytek.dev";
const ADMIN_NAME = "Admin";
const ADMIN_PASSWORD = "BytekAdmin123!";

// ── PBKDF2 hashing (mirrors src/core/auth.ts) ────────────────────

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const encoder = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    256,
  );

  return `${arrayBufferToBase64(salt.buffer)}.${arrayBufferToBase64(hash)}`;
}

// ── Main ──────────────────────────────────────────────────────────

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const sql = `INSERT INTO users (email, name, password_hash) VALUES ('${ADMIN_EMAIL}', '${ADMIN_NAME}', '${passwordHash}') ON CONFLICT (email) DO NOTHING;`;

  console.log("🌱 Seeding admin user...");
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Name:  ${ADMIN_NAME}`);
  console.log("");

  // Execute via wrangler d1
  const { execSync } = await import("node:child_process");

  try {
    execSync(
      `pnpm wrangler d1 execute bytek-db --local --command="${sql}"`,
      { stdio: "inherit" },
    );
    console.log("");
    console.log("✅ Admin user seeded successfully!");
  } catch {
    console.error("❌ Failed to seed admin user. Is the database migrated?");
    process.exit(1);
  }
}

main();
