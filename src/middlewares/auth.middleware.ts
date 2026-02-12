import type { Context, Next } from "hono";

import type { AppEnv } from "@core/app-types";
import { verifyToken } from "@core/auth";
import { UnauthorizedError } from "@exceptions/http-exceptions";

/**
 * Middleware that validates the JWT from the Authorization header.
 * Sets `userId` and `userEmail` in the context for downstream handlers.
 *
 * Expected header format: `Authorization: Bearer <token>`
 */
export async function authMiddleware(
  c: Context<AppEnv>,
  next: Next,
): Promise<void> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token, c.env.JWT_SECRET);

  if (!payload) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  c.set("userId", payload.sub);
  c.set("userEmail", payload.email);

  await next();
}
