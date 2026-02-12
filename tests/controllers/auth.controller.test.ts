import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll } from "vitest";

import { hashPassword } from "@core/auth";
import "@app";

// ── Seed Test User ────────────────────────────────────────────────

const TEST_USER = {
  email: "test@bytek.dev",
  name: "Test User",
  password: "TestPassword123!",
};

beforeAll(async () => {
  const passwordHash = await hashPassword(TEST_USER.password);

  await env.DB.prepare(
    "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING",
  )
    .bind(TEST_USER.email, TEST_USER.name, passwordHash)
    .run();
});

// ── Helpers ───────────────────────────────────────────────────────

async function loginAndGetToken(): Promise<string> {
  const res = await SELF.fetch("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: TEST_USER.email,
      password: TEST_USER.password,
    }),
  });
  const body = await res.json<{ data: { token: string } }>();
  return body.data.token;
}

// ── POST /api/auth/login ──────────────────────────────────────────

describe("POST /api/auth/login", () => {
  it("returns 200 with token and user on valid credentials", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: TEST_USER.password,
      }),
    });

    expect(res.status).toBe(200);

    const body = await res.json<{
      success: boolean;
      data: { token: string; user: { id: number; email: string; name: string } };
    }>();

    expect(body.success).toBe(true);
    expect(body.data.token).toBeTypeOf("string");
    expect(body.data.token.split(".")).toHaveLength(3);
    expect(body.data.user.email).toBe(TEST_USER.email);
    expect(body.data.user.name).toBe(TEST_USER.name);
    expect(body.data.user.id).toBeTypeOf("number");
  });

  it("returns 401 for wrong password", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_USER.email,
        password: "WrongPassword!",
      }),
    });

    expect(res.status).toBe(401);

    const body = await res.json<{
      success: boolean;
      error: { code: string; message: string };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Invalid credentials");
  });

  it("returns 401 for non-existent email", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "nobody@bytek.dev",
        password: "SomePassword123!",
      }),
    });

    expect(res.status).toBe(401);

    const body = await res.json<{
      success: boolean;
      error: { code: string; message: string };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 400 validation error for invalid email", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "not-an-email",
        password: "ValidPassword123!",
      }),
    });

    expect(res.status).toBe(400);

    const body = await res.json<{
      success: boolean;
      error: { code: string; message: string; details: { field: string; message: string }[] };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Invalid input data");
    expect(body.error.details).toBeInstanceOf(Array);
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it("returns 400 validation error for short password", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "valid@bytek.dev",
        password: "short",
      }),
    });

    expect(res.status).toBe(400);

    const body = await res.json<{
      success: boolean;
      error: { code: string; details: { field: string; message: string }[] };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 validation error for empty body", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);

    const body = await res.json<{ success: boolean; error: { code: string } }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

// ── GET /api/auth/me ──────────────────────────────────────────────

describe("GET /api/auth/me", () => {
  it("returns 200 with user profile when authenticated", async () => {
    const token = await loginAndGetToken();

    const res = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);

    const body = await res.json<{
      success: boolean;
      data: { id: number; email: string; name: string; createdAt: string };
    }>();

    expect(body.success).toBe(true);
    expect(body.data.email).toBe(TEST_USER.email);
    expect(body.data.name).toBe(TEST_USER.name);
    expect(body.data.id).toBeTypeOf("number");
    expect(body.data.createdAt).toBeTypeOf("string");
  });

  it("returns 401 when no Authorization header is provided", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/me");

    expect(res.status).toBe(401);

    const body = await res.json<{
      success: boolean;
      error: { code: string; message: string };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Missing or invalid authorization header");
  });

  it("returns 401 with an invalid token", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });

    expect(res.status).toBe(401);

    const body = await res.json<{
      success: boolean;
      error: { code: string; message: string };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(body.error.message).toBe("Invalid or expired token");
  });

  it("returns 401 when Authorization header is not Bearer format", async () => {
    const res = await SELF.fetch("http://localhost/api/auth/me", {
      headers: { Authorization: "Basic somevalue" },
    });

    expect(res.status).toBe(401);

    const body = await res.json<{
      success: boolean;
      error: { code: string };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

// ── Health Check ──────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns status ok", async () => {
    const res = await SELF.fetch("http://localhost/health");

    expect(res.status).toBe(200);

    const body = await res.json<{ status: string; timestamp: string }>();

    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeTypeOf("string");
  });
});

// ── 404 Handling ──────────────────────────────────────────────────

describe("Not Found handling", () => {
  it("returns 404 with standard error format for unknown routes", async () => {
    const res = await SELF.fetch("http://localhost/api/nonexistent");

    expect(res.status).toBe(404);

    const body = await res.json<{
      success: boolean;
      error: { code: string; message: string };
    }>();

    expect(body.success).toBe(false);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Not found");
  });
});
