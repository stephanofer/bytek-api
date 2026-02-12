import { describe, it, expect } from "vitest";

import { hashPassword, verifyPassword, createToken, verifyToken } from "@core/auth";

// ── Password Hashing ──────────────────────────────────────────────

describe("hashPassword", () => {
  it("returns a string in format base64(salt).base64(hash)", async () => {
    const hash = await hashPassword("TestPassword123!");
    const parts = hash.split(".");

    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("produces different hashes for the same password (random salt)", async () => {
    const hash1 = await hashPassword("SamePassword!");
    const hash2 = await hashPassword("SamePassword!");

    expect(hash1).not.toBe(hash2);
  });
});

describe("verifyPassword", () => {
  it("returns true for correct password", async () => {
    const password = "CorrectPassword123!";
    const hash = await hashPassword(password);

    const result = await verifyPassword(password, hash);

    expect(result).toBe(true);
  });

  it("returns false for incorrect password", async () => {
    const hash = await hashPassword("CorrectPassword123!");

    const result = await verifyPassword("WrongPassword!", hash);

    expect(result).toBe(false);
  });

  it("returns false for malformed hash (no dot separator)", async () => {
    const result = await verifyPassword("any", "invalidhash");

    expect(result).toBe(false);
  });

  it("returns false for empty hash", async () => {
    const result = await verifyPassword("any", "");

    expect(result).toBe(false);
  });
});

// ── JWT ───────────────────────────────────────────────────────────

const TEST_SECRET = "test-jwt-secret-key";

describe("createToken", () => {
  it("returns a valid JWT string with 3 parts", async () => {
    const token = await createToken(1, "admin@bytek.dev", TEST_SECRET);
    const parts = token.split(".");

    expect(parts).toHaveLength(3);
  });

  it("includes correct payload data", async () => {
    const token = await createToken(42, "user@example.com", TEST_SECRET);
    const [, payloadB64] = token.split(".");

    // Decode base64url → JSON
    const padded = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(padded));

    expect(payload.sub).toBe(42);
    expect(payload.email).toBe("user@example.com");
    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });
});

describe("verifyToken", () => {
  it("returns payload for a valid token", async () => {
    const token = await createToken(1, "admin@bytek.dev", TEST_SECRET);

    const payload = await verifyToken(token, TEST_SECRET);

    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(1);
    expect(payload!.email).toBe("admin@bytek.dev");
  });

  it("returns null for a token signed with a different secret", async () => {
    const token = await createToken(1, "admin@bytek.dev", TEST_SECRET);

    const payload = await verifyToken(token, "wrong-secret");

    expect(payload).toBeNull();
  });

  it("returns null for a malformed token", async () => {
    const payload = await verifyToken("not.a.jwt", TEST_SECRET);

    expect(payload).toBeNull();
  });

  it("returns null for a token with only 2 parts", async () => {
    const payload = await verifyToken("two.parts", TEST_SECRET);

    expect(payload).toBeNull();
  });

  it("returns null for an empty string", async () => {
    const payload = await verifyToken("", TEST_SECRET);

    expect(payload).toBeNull();
  });
});
