import z from "zod";
import "@hono/zod-openapi";

// ── Login Input ───────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z
    .email({ error: "Invalid email address" })
    .openapi({ example: "admin@bytek.dev" }),
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters" })
    .openapi({ example: "SecurePass123!" }),
});

// ── Login Data (what goes inside `data`) ──────────────────────────

export const LoginDataSchema = z
  .object({
    token: z.string().openapi({ example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }),
    user: z.object({
      id: z.number().openapi({ example: 1 }),
      email: z.email().openapi({ example: "admin@bytek.dev" }),
      name: z.string().openapi({ example: "Admin" }),
    }),
  })
  .openapi("LoginData");

// ── User Profile ──────────────────────────────────────────────────

export const UserProfileSchema = z
  .object({
    id: z.number().openapi({ example: 1 }),
    email: z.email().openapi({ example: "admin@bytek.dev" }),
    name: z.string().openapi({ example: "Admin" }),
    createdAt: z.string().openapi({ example: "2025-01-01 00:00:00" }),
  })
  .openapi("UserProfile");

// ── Type Exports ──────────────────────────────────────────────────

export type LoginInput = z.infer<typeof LoginSchema>;
export type LoginData = z.infer<typeof LoginDataSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
