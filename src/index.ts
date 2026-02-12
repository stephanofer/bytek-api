import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";

import type { AppEnv } from "@core/app-types";
import { ERROR_CODE } from "@core/responses";
import { authController } from "@controllers/auth.controller";
import { dbMiddleware } from "@middlewares/db.middleware";

const app = new Hono<AppEnv>();

// ── Global Middleware ──────────────────────────────────────────────
app.use("*", logger());
app.use("*", requestId());
app.use("*", secureHeaders());
app.use("*", cors());
app.use("*", dbMiddleware);

// ── Health Check ───────────────────────────────────────────────────
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Mount Controllers ──────────────────────────────────────────────
app.route("/api/auth", authController);

// ── OpenAPI Documentation ──────────────────────────────────────────
app.get(
  "/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "Bytek API",
        version: "1.0.0",
        description: "Bytek CMS API - Built with Hono on Cloudflare Workers",
      },
      servers: [
        {
          url: "http://localhost:8787",
          description: "Local development",
        },
      ],
      components: {
        securitySchemes: {
          Bearer: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  }),
);

app.get(
  "/docs",
  Scalar({
    theme: "kepler",
    url: "/openapi",
  }),
);

// ── Status Code → Error Code Mapping ──────────────────────────────
const STATUS_TO_ERROR_CODE: Record<number, string> = {
  400: ERROR_CODE.BAD_REQUEST,
  401: ERROR_CODE.UNAUTHORIZED,
  403: ERROR_CODE.FORBIDDEN,
  404: ERROR_CODE.NOT_FOUND,
  409: ERROR_CODE.CONFLICT,
  500: ERROR_CODE.INTERNAL_ERROR,
};

// ── Global Error Handling ──────────────────────────────────────────
app.onError((err, c) => {
  console.error(`[Error] ${err.message}`, err.stack);

  // HTTPException from custom errors (UnauthorizedError, NotFoundError, etc.)
  if ("status" in err && typeof err.status === "number") {
    const status = err.status;
    const code = STATUS_TO_ERROR_CODE[status] ?? ERROR_CODE.INTERNAL_ERROR;

    return c.json(
      {
        success: false as const,
        error: { code, message: err.message },
      },
      status as 400,
    );
  }

  // Unknown errors
  return c.json(
    {
      success: false as const,
      error: {
        code: ERROR_CODE.INTERNAL_ERROR,
        message: "Internal server error",
      },
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      success: false as const,
      error: {
        code: ERROR_CODE.NOT_FOUND,
        message: "Not found",
      },
    },
    404,
  );
});

export default app;
