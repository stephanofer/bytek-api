# Bytek API

Bytek is a new technology modern company specializing in software development and IT consulting. This repository contains the codebase for the Bytek API.

## Auto-invoke Skills

When performing these actions, ALWAYS invoke the corresponding skill FIRST:

| Action                                                                | Skill           |

| --------------------------------------------------------------------- | --------------- |
| When you need to use something with zod | `zod-4` |
When you need yo use something with typescript | `typescript` |
When you need to use something related with hono | `hono-expert` |
When you need to use something related with cloudflare workers, R2, D1, AI| `cloudflare` |


## Non-negotiables

- Never use barrel files 
- Always use path aliases instead of imports
- Always use pnpm as the package manager

## Tech Stack

| Component  | Location           | Technology                 |

| ---------- | ------------------ | -------------------------- |

| API         | `src/`             | Hono, Zod, Cloudflare Workers, Cloudflare R2, Cloudflare AI, Cloudflare D1 with Drizzle  |
| Error Monitoring | Sentry | Sentry SDK |
| Testing     | `tests/`           | Vitest, @cloudflare/vitest-pool-workers       |

## Directory Structure
```
├── src/
│   ├── index.ts              # App entry point
│   │
│   ├── schemas/              # Zod schemas (single source of truth)
│   │   └── user.schema.ts
│   │
│   ├── controllers/          # HTTP handlers (thin layer)
│   │   └── user.controller.ts
│   │
│   ├── services/             # Business logic (no HTTP details)
│   │   └── user.service.ts
│   │
│   ├── middlewares/          # Auth, logging, error handling
│   │   └── auth.middleware.ts
│   │
│   ├── models/               # Database models/DTOs
│   │   └── user.model.ts
│   │
│   ├── core/                 # Utilities and helpers
│   │   ├── logger.ts
│   │   ├── mailer.ts
│   │   └── auth.ts
│   │
│   ├── exceptions/           # Custom error classes
│   │   └── http-exceptions.ts
│   │
│   ├── crons/                # Background jobs
│   │   └── cleanup.cron.ts
│   │
│   └── db/                   # Database setup
│       └── index.ts
│
└── tests/                    # Mirrors src/ structure
    ├── controllers/
    ├── services/
    └── core/
``` 
