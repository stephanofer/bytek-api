# Bytek API

Bytek is a new technology modern company specializing in software development and IT consulting. This repository contains the codebase for the Bytek API.

This principality API is Simple CMS for Bytek's website

## Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action | Skill |
| --- | --- |
| When you need to use something with zod | `zod-4` |
| When you need to use something with typescript | `typescript` |
| When you need to use something related with hono | `hono-expert` |
| When you need to use something related with cloudflare workers, R2, D1, AI | `cloudflare` |

## Non-negotiables

- Never use barrel files
- Always use path aliases instead of relative imports
- Always use pnpm as the package manager
- **ALL API responses MUST follow the standard response format** (see below)
- Use `success()` / `paginated()` helpers from `@core/responses` in controllers
- Use `validate()` from `@core/validator` instead of raw `zValidator`
- Throw custom exceptions from `@exceptions/http-exceptions` in services — the global error handler formats them automatically

## Tech Stack

| Component | Location | Technology |
| --- | --- | --- |
| API | `src/` | Hono, Zod, Cloudflare Workers, Cloudflare R2, Cloudflare AI, Cloudflare D1 with Drizzle |
| Error Monitoring | Sentry | Sentry SDK |
| Testing | `tests/` | Vitest, @cloudflare/vitest-pool-workers |

## Directory Structure

```
├── src/
│   ├── index.ts              # App entry point + global error handler
│   ├── schemas/              # Zod schemas (single source of truth)
│   ├── controllers/          # HTTP handlers (thin layer)
│   ├── services/             # Business logic (no HTTP details)
│   ├── middlewares/          # Auth, logging, error handling
│   ├── models/               # Database models/DTOs
│   ├── core/                 # Utilities and helpers
│   │   ├── app-types.ts      # AppEnv, AppRouter types
│   │   ├── auth.ts           # Password hashing + JWT (Web Crypto API)
│   │   ├── responses.ts      # Standard response helpers + OpenAPI schema factories
│   │   └── validator.ts      # Zod validation wrapper with standard error format
│   ├── exceptions/           # Custom error classes
│   │   └── http-exceptions.ts
│   ├── crons/                # Background jobs
│   └── db/                   # Database setup + Drizzle schema
├── scripts/
│   ├── seed.mjs              # Seed initial admin user
│   └── generate-openapi.mjs  # Generate static openapi.json
├── docs/
│   └── openapi.json          # Generated OpenAPI spec (import into APIDOG)
└── tests/                    # Mirrors src/ structure
```

## API Response Standard

ALL endpoints MUST return responses in this format. No exceptions.

### Success (single item)

```json
{
  "success": true,
  "data": { ... }
}
```

Controller usage: `return success(c, data)` or `return success(c, data, 201)`

### Success (paginated list — for blog posts, content, etc.)

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 50,
    "page": 1,
    "pageSize": 10,
    "totalPages": 5
  }
}
```

Controller usage: `return paginated(c, items, buildPaginationMeta(total, page, pageSize))`

### Error

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials"
  }
}
```

Handled automatically by the global error handler in `index.ts`. Services just throw: `throw new UnauthorizedError("Invalid credentials")`

### Validation Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email address" }
    ]
  }
}
```

Handled automatically by the `validate()` wrapper. Controllers just use: `validate("json", MySchema)`

### Error Codes

| Code | HTTP Status | When |
| --- | --- | --- |
| `BAD_REQUEST` | 400 | Malformed request |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `UNAUTHORIZED` | 401 | Missing/invalid token or credentials |
| `FORBIDDEN` | 403 | Authenticated but not allowed |
| `NOT_FOUND` | 404 | Resource or route not found |
| `CONFLICT` | 409 | Duplicate resource |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

### OpenAPI Schema Helpers

When documenting responses in `describeRoute`, use the schema factories from `@core/responses`:

```typescript
import { successSchema, paginatedSchema, ErrorResponseSchema, ValidationErrorResponseSchema } from "@core/responses";

// Single item response
schema: resolver(successSchema(MyDataSchema))

// Paginated list response
schema: resolver(paginatedSchema(MyItemSchema))

// Error responses
schema: resolver(ErrorResponseSchema)
schema: resolver(ValidationErrorResponseSchema)
```