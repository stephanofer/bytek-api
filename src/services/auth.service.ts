import { eq } from "drizzle-orm";

import { createToken, verifyPassword } from "@core/auth";
import type { Database } from "@db";
import { users } from "@db/schema";
import { UnauthorizedError } from "@exceptions/http-exceptions";
import type { LoginData, LoginInput, UserProfile } from "@schemas/auth.schema";

/**
 * Authenticates a user with email/password and returns a JWT.
 */
export async function login(
  input: LoginInput,
  db: Database,
  jwtSecret: string,
): Promise<LoginData> {
  const user = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, input.email))
    .get();

  if (!user) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = await createToken(user.id, user.email, jwtSecret);

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  };
}

/**
 * Returns the profile of the authenticated user.
 */
export async function getMe(
  userId: number,
  db: Database,
): Promise<UserProfile> {
  const user = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  return user;
}
