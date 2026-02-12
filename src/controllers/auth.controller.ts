import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";

import type { AppEnv } from "@core/app-types";
import {
  ErrorResponseSchema,
  ValidationErrorResponseSchema,
  success,
  successSchema,
} from "@core/responses";
import { validate } from "@core/validator";
import { authMiddleware } from "@middlewares/auth.middleware";
import {
  LoginDataSchema,
  LoginSchema,
  UserProfileSchema,
} from "@schemas/auth.schema";
import { getMe, login } from "@services/auth.service";

const authController = new Hono<AppEnv>();

// ── POST /auth/login ──────────────────────────────────────────────

authController.post(
  "/login",
  describeRoute({
    tags: ["Auth"],
    summary: "Login",
    description: "Authenticate with email and password to receive a JWT token",
    responses: {
      200: {
        description: "Login successful",
        content: {
          "application/json": {
            schema: resolver(successSchema(LoginDataSchema)),
          },
        },
      },
      400: {
        description: "Validation error",
        content: {
          "application/json": {
            schema: resolver(ValidationErrorResponseSchema),
          },
        },
      },
      401: {
        description: "Invalid credentials",
        content: {
          "application/json": { schema: resolver(ErrorResponseSchema) },
        },
      },
    },
  }),
  validate("json", LoginSchema),
  async (c) => {
    const input = c.req.valid("json");
    const data = await login(input, c.var.db, c.env.JWT_SECRET);
    return success(c, data);
  },
);

// ── GET /auth/me ──────────────────────────────────────────────────

authController.get(
  "/me",
  describeRoute({
    tags: ["Auth"],
    summary: "Get current user",
    description: "Returns the profile of the authenticated user",
    security: [{ Bearer: [] }],
    responses: {
      200: {
        description: "User profile",
        content: {
          "application/json": {
            schema: resolver(successSchema(UserProfileSchema)),
          },
        },
      },
      401: {
        description: "Unauthorized",
        content: {
          "application/json": { schema: resolver(ErrorResponseSchema) },
        },
      },
    },
  }),
  authMiddleware,
  async (c) => {
    const userId = c.var.userId;
    const data = await getMe(userId, c.var.db);
    return success(c, data);
  },
);

export { authController };
