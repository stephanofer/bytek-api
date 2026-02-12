import type { Env, ValidationTargets } from "hono";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import { validator } from "hono-openapi";

import { ERROR_CODE } from "@core/responses";

/**
 * Wrapper around hono-openapi's validator that formats validation errors
 * into the standard API error response format.
 *
 * Usage (same as the original validator):
 *   validate("json", LoginSchema)
 */
export function validate<
  Schema extends StandardSchemaV1,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
>(target: Target, schema: Schema) {
  return validator<Schema, Target, E, P>(target, schema, (result, c) => {
    if (!result.success) {
      const details = result.error.map((issue) => ({
        field: issue.path?.map((p) => (typeof p === "object" && "key" in p ? p.key : p)).join(".") ?? "unknown",
        message: issue.message,
      }));

      return c.json(
        {
          success: false as const,
          error: {
            code: ERROR_CODE.VALIDATION_ERROR,
            message: "Invalid input data",
            details,
          },
        },
        400,
      );
    }
  });
}
