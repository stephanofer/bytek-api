# Bytek API - Workflow

## Stack

| Componente | Tecnologia |
|---|---|
| Runtime | Cloudflare Workers |
| Framework | Hono |
| Base de datos | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM |
| Validacion | Zod v4 |
| Documentacion | OpenAPI + Scalar |
| Testing | Vitest + @cloudflare/vitest-pool-workers |

---

## Scripts disponibles

```bash
pnpm dev                  # Servidor local (wrangler dev)
pnpm deploy               # Deploy a produccion (Cloudflare Workers)
pnpm cf-typegen           # Regenerar tipos de CloudflareBindings
pnpm db:generate          # Generar migracion SQL desde el schema de Drizzle
pnpm db:migrate:local     # Aplicar migraciones en la DB local
pnpm db:migrate:remote    # Aplicar migraciones en la DB de produccion
pnpm db:studio            # Abrir Drizzle Studio (UI para explorar la DB)
pnpm db:push              # Push directo del schema (sin generar migracion)
pnpm test                 # Correr tests
pnpm test:watch           # Tests en modo watch
pnpm typecheck            # Verificar tipos TypeScript
```

---

## Estructura del proyecto

```
src/
  index.ts              # Entry point - Hono app, middleware global, error handling
  core/
    app-types.ts        # Tipos centrales (AppEnv, AppRouter)
  db/
    index.ts            # Factory de Drizzle (createDb)
    schema.ts           # Definiciones de tablas (UNICA FUENTE DE VERDAD para la DB)
  schemas/              # Zod schemas (validacion de requests/responses)
  controllers/          # Handlers HTTP (capa fina)
  services/             # Logica de negocio (sin conocimiento HTTP)
  middlewares/          # Auth, DB injection, etc.
  models/               # DTOs, tipos de datos
  exceptions/           # Clases de error HTTP custom
  crons/                # Background jobs
drizzle/
  migrations/           # SQL migrations generadas por Drizzle Kit
tests/                  # Tests (misma estructura que src/)
```

---

## Flujo de desarrollo local

### 1. Setup inicial (una sola vez)

```bash
pnpm install
cp .dev.vars.example .dev.vars     # Configurar credenciales de Cloudflare
pnpm cf-typegen                     # Generar tipos de bindings
pnpm db:migrate:local               # Aplicar migraciones existentes a la DB local
pnpm dev                            # Arrancar servidor local
```

### 2. Ciclo de desarrollo diario

```bash
pnpm dev       # Abre http://localhost:8787
               # Hot reload automatico
               # DB local en .wrangler/state/
               # Docs en http://localhost:8787/docs
```

---

## Flujo de cambios en la base de datos

Este es el punto clave. Drizzle ORM actua como UNICA FUENTE DE VERDAD del schema de la DB.

### Agregar/modificar tablas

```
1. Editar src/db/schema.ts         → Definir/modificar tablas con Drizzle
2. pnpm db:generate                → Genera SQL migration en drizzle/migrations/
3. Revisar el SQL generado         → Verificar que los cambios son correctos
4. pnpm db:migrate:local           → Aplicar a la DB local (wrangler d1)
5. Testear localmente              → pnpm dev + probar endpoints
6. Commit del schema + migracion   → git add + git commit
7. pnpm db:migrate:remote          → Aplicar a produccion (cuando estes listo)
8. pnpm deploy                     → Deploy del worker
```

### Reglas de oro

- **NUNCA** edites las migraciones SQL generadas a mano (salvo seeds o datos iniciales).
- **SIEMPRE** ejecuta `db:migrate:local` antes de probar cambios localmente.
- **SIEMPRE** commitea el archivo de schema Y la migracion juntos.
- Para produccion: primero `db:migrate:remote`, despues `deploy`.

### Drizzle Kit vs Wrangler Migrations

Drizzle Kit genera los archivos SQL. Wrangler los aplica a D1.

```
  src/db/schema.ts  ──(drizzle-kit generate)──>  drizzle/migrations/0001_xxx.sql
                                                         │
                                         ┌───────────────┤
                                         │               │
                              (wrangler --local)   (wrangler --remote)
                                         │               │
                                    DB Local         DB Produccion
```

---

## Flujo para crear una nueva feature

### Ejemplo: crear endpoint de usuarios

#### 1. Schema de la DB (`src/db/schema.ts`)

```typescript
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
```

#### 2. Zod schemas (`src/schemas/user.schema.ts`)

```typescript
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.email(),
  name: z.string().min(2),
});

export const UserResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  name: z.string(),
  createdAt: z.string(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
```

#### 3. Service (`src/services/user.service.ts`)

```typescript
import { eq } from "drizzle-orm";

import type { Database } from "@db";
import { users } from "@db/schema";
import type { CreateUserInput, UserResponse } from "@schemas/user.schema";
import { ConflictError, NotFoundError } from "@exceptions/http-exceptions";

export const userService = {
  async create(db: Database, data: CreateUserInput): Promise<UserResponse> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  },

  async getById(db: Database, id: number): Promise<UserResponse> {
    const user = await db.select().from(users).where(eq(users.id, id)).get();
    if (!user) throw new NotFoundError("User");
    return user;
  },
};
```

#### 4. Controller (`src/controllers/user.controller.ts`)

```typescript
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import { resolver, validator as zValidator } from "hono-openapi/zod";

import type { AppEnv } from "@core/app-types";
import { CreateUserSchema, UserResponseSchema } from "@schemas/user.schema";
import { userService } from "@services/user.service";

export const userController = new Hono<AppEnv>();

userController.post(
  "/users",
  describeRoute({
    summary: "Create user",
    responses: {
      201: {
        description: "User created",
        content: {
          "application/json": { schema: resolver(UserResponseSchema) },
        },
      },
    },
  }),
  zValidator("json", CreateUserSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = await userService.create(c.var.db, data);
    return c.json(user, 201);
  },
);
```

#### 5. Montar en el entry point (`src/index.ts`)

```typescript
import { userController } from "@controllers/user.controller";

app.route("/api", userController);
```

---

## Flujo de deploy a produccion

```bash
# 1. Verificar que todo compila
pnpm typecheck

# 2. Correr tests
pnpm test

# 3. Aplicar migraciones a la DB de produccion
pnpm db:migrate:remote

# 4. Deploy del worker
pnpm deploy
```

---

## Variables de entorno y secrets

| Tipo | Donde | Ejemplo |
|---|---|---|
| Secrets (API keys, tokens) | `wrangler secret put SECRET_NAME` | JWT_SECRET |
| Variables de entorno | `wrangler.jsonc` → `vars` | ENVIRONMENT=production |
| Credenciales de Drizzle Kit | `.dev.vars` (local only, gitignored) | CLOUDFLARE_ACCOUNT_ID |

**Importante**: `.dev.vars` es SOLO para credenciales de Drizzle Kit (para que pueda conectarse a D1 via HTTP). En runtime, el Worker accede a D1 via el binding `env.DB` directamente.

---

## Path Aliases

Configurados en `tsconfig.json`. Usarlos SIEMPRE en vez de imports relativos:

```typescript
// Correcto
import { users } from "@db/schema";
import { userService } from "@services/user.service";
import type { AppEnv } from "@core/app-types";

// Incorrecto
import { users } from "../../db/schema";
```

---

## OpenAPI + Documentacion

- **Spec JSON**: `GET /openapi`
- **UI interactiva (Scalar)**: `GET /docs`

La documentacion se genera AUTOMATICAMENTE desde los Zod schemas usados en `describeRoute()` y `zValidator()`. Cuando actualizas un schema, la documentacion se actualiza sola.

---

## Notas importantes

- **D1 es SQLite**: no soporta tipos de dato avanzados (JSON nativo, ENUM, etc). Usa TEXT para fechas y JSON serializado.
- **Limite de 10 GB por base de datos** en el plan pago, 500 MB en el free tier.
- **`pnpm cf-typegen`**: correr cada vez que cambias bindings en `wrangler.jsonc`.
- **Time Travel**: D1 tiene recuperacion point-in-time (7 dias free, 30 dias pago).
- **No hay barrel files**: importar directamente desde el archivo, no desde `index.ts` de carpetas.
