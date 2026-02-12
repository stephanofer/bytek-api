import type { Context } from "hono";
import z from "zod";
import "@hono/zod-openapi";

import type { AppEnv } from "@core/app-types";

// ── Error Codes ───────────────────────────────────────────────────

const ERROR_CODE = {
  BAD_REQUEST: "BAD_REQUEST",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

type ErrorCode = (typeof ERROR_CODE)[keyof typeof ERROR_CODE];

export { ERROR_CODE, type ErrorCode };

// ── Response Helpers ──────────────────────────────────────────────

interface PaginationMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Send a successful response with a single data item.
 */
export function success<T>(c: Context<AppEnv>, data: T, status: 200 | 201 = 200) {
  return c.json({ success: true as const, data }, status);
}

/**
 * Send a successful paginated response (for lists like blog posts).
 */
export function paginated<T>(c: Context<AppEnv>, data: T[], meta: PaginationMeta) {
  return c.json({ success: true as const, data, meta }, 200);
}

/**
 * Build pagination meta from total count and query params.
 */
export function buildPaginationMeta(total: number, page: number, pageSize: number): PaginationMeta {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ── OpenAPI Schema Factories ──────────────────────────────────────

/**
 * Wraps a data schema into the standard success envelope for OpenAPI docs.
 *
 * Usage in describeRoute:
 *   schema: resolver(successSchema(UserProfileSchema))
 */
export function successSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    success: z.literal(true).openapi({ example: true }),
    data: dataSchema,
  });
}

/**
 * Wraps a data schema into the standard paginated envelope for OpenAPI docs.
 *
 * Usage in describeRoute:
 *   schema: resolver(paginatedSchema(PostSchema))
 */
export function paginatedSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    success: z.literal(true).openapi({ example: true }),
    data: z.array(itemSchema),
    meta: z.object({
      total: z.number().openapi({ example: 50 }),
      page: z.number().openapi({ example: 1 }),
      pageSize: z.number().openapi({ example: 10 }),
      totalPages: z.number().openapi({ example: 5 }),
    }).openapi("PaginationMeta"),
  });
}

/**
 * Standard error response schema for OpenAPI docs.
 */
export const ErrorResponseSchema = z
  .object({
    success: z.literal(false).openapi({ example: false }),
    error: z.object({
      code: z.string().openapi({ example: "UNAUTHORIZED" }),
      message: z.string().openapi({ example: "Invalid credentials" }),
    }),
  })
  .openapi("ErrorResponse");

/**
 * Validation error response schema for OpenAPI docs.
 */
export const ValidationErrorResponseSchema = z
  .object({
    success: z.literal(false).openapi({ example: false }),
    error: z.object({
      code: z.literal("VALIDATION_ERROR").openapi({ example: "VALIDATION_ERROR" }),
      message: z.string().openapi({ example: "Invalid input data" }),
      details: z.array(
        z.object({
          field: z.string().openapi({ example: "email" }),
          message: z.string().openapi({ example: "Invalid email address" }),
        }),
      ),
    }),
  })
  .openapi("ValidationErrorResponse");

// ── Pagination Query Schema ───────────────────────────────────────

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).openapi({ example: 1 }),
  pageSize: z.coerce.number().int().positive().max(100).default(10).openapi({ example: 10 }),
});

export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
