---
name: hono-expert
description: >
  Hono framework expert patterns.
  Trigger: When working with the Hono framework for building APIs.
license: Apache-2.0
---

# The Core Principle: Write Once, Use Everywhere

The secret to maintainable APIs is defining your data structures once and using them everywhere. With Zod schemas, you get:

- Runtime validation in controllers
- OpenAPI documentation generation
- Type-safe tests with guaranteed valid data
- No duplication, no drift between docs and reality.

---

## Building a Feature: Step-by-Step

Let's build a user registration endpoint to see how everything connects.

### 1. Define Your Schema (Single Source of Truth)

```typescript
// src/schemas/user.schema.ts
import z from "zod";

// For extending the Zod schema with OpenAPI properties
import "@hono/zod-openapi";

export const CreateUserSchema = z.object({
  email: z.string().email().openapi({ example: 'user@example.com' }),
  password: z.string().min(8).openapi({ example: 'SecurePass123!' }),
  name: z.string().min(2).openapi({ example: 'John Doe' })
});

export const UserResponseSchema = z.object({
  id: z.string().uuid().openapi({ example: "00000000-0000-0000-0000-000000000000" }),
  email: z.string().email().openapi({ example: "user@example.com" }),
  name: z.string().openapi({ example: "John Doe" }),
  createdAt: z.string().datetime().openapi({ example: "2022-01-01" })
}).openapi('User');

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
```

---

### 2. Implement Business Logic (Pure, Testable)

```typescript
// src/services/user.service.ts
import type { CreateUserInput, UserResponse } from '@schemas/user.schema';
import { db } from '@db';
import { hashPassword } from '@core/auth';

export const userService = {
  async createUser(data: CreateUserInput): Promise<UserResponse> {
    const hashedPassword = await hashPassword(data.password);

    const user = await db.users.create({
      email: data.email,
      password: hashedPassword,
      name: data.name
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString()
    };
  }
};
```

Services contain pure business logic — no HTTP concepts, easy to test.

---

### 3. Create the Controller (HTTP Layer)

```typescript
// src/controllers/user.controller.ts
import { Hono } from 'hono';
import { describeRoute } from 'hono-openapi';
import { resolver, validator as zValidator } from 'hono-openapi/zod';
import { CreateUserSchema, UserResponseSchema } from '@schemas/user.schema';
import { userService } from '@services/user.service';

export const userController = new Hono();

userController.post(
  '/users',
  describeRoute({
    summary: 'Create user',
    description: 'Register a new user account',
    responses: {
      201: {
        description: 'User created successfully',
        content: {
          'application/json': { schema: resolver(UserResponseSchema) }
        }
      },
      400: { description: 'Invalid input data' }
    }
  }),
  zValidator('json', CreateUserSchema),
  async (c) => {
    const data = c.req.valid('json');
    const user = await userService.createUser(data);
    return c.json(user, 201);
  }
);
```

Notice how both schemas are used here:

- `zValidator('json', CreateUserSchema)` — validates incoming request bodies at runtime; invalid data never reaches your service layer.
- `resolver(UserResponseSchema)` in `describeRoute` — generates OpenAPI documentation with all field types, descriptions, and examples defined in the schema.

Controllers are thin: validate input, call services, return responses. The schemas do the heavy lifting.

---

### 4. Wire Up Routes and Documentation

```typescript
// src/index.ts
import { Hono } from 'hono';
import { openAPISpecs } from 'hono-openapi';
import { Scalar } from '@scalar/hono-api-reference';
import { userController } from '@controllers/user.controller';

const app = new Hono();

// Mount routes
app.route('/api', userController);

// Interactive API docs (Scalar)
app.get('/docs', Scalar({ theme: 'default', url: '/openapi' }));

// OpenAPI spec generated from Zod schemas
app.get(
  '/openapi',
  openAPISpecs(app, {
    documentation: {
      info: {
        title: 'My API',
        version: '1.0.0',
        description: 'Production-ready Hono API'
      },
      servers: [{ url: 'http://localhost:3000', description: 'Local server' }]
    }
  })
);

export default {
  port: 3000,
  fetch: app.fetch,
};
```

`/docs` serves an interactive API reference powered by Scalar. `/openapi` exposes the spec generated from your Zod schemas.

---

### 5. Write Tests (Using the Same Schemas)

```typescript
// tests/controllers/user.controller.test.ts
import { describe, test, expect } from '';
import { CreateUserSchema, UserResponseSchema } from '@schemas/user.schema';
import app from '@app';

describe('POST /api/users', () => {
  test('creates user with valid data', async () => {
    const validData = {
      email: 'test@example.com',
      password: 'SecurePass123!',
      name: 'Test User'
    };

    CreateUserSchema.parse(validData);

    const res = await app.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(validData),
      headers: { 'Content-Type': 'application/json' }
    });

    expect(res.status).toBe(201);

    const body = await res.json();
    const validated = UserResponseSchema.parse(body);
    expect(validated.email).toBe(validData.email);
  });
});
```

Tests use the same schemas — when validation changes, invalid tests fail immediately.

---

## Architecture Best Practices

### Separation of Concerns

| Layer | Responsibility |
|-------|---------------|
| **Controllers** | HTTP handling: validation, status codes, headers |
| **Services** | Pure business logic — usable in controllers, crons, CLI |
| **Models** | Database interaction and data mapping |
| **Core** | Reusable utilities: logger, mailer, auth helpers |

### Path Aliases for Clean Imports

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": "./src",
    "paths": {
      "@app": ["index"],
      "@controllers/*": ["controllers/*"],
      "@services/*": ["services/*"],
      "@schemas/*": ["schemas/*"],
      "@core/*": ["core/*"],
      "@db/*": ["db/*"]
    }
  }
}
```

```typescript
import { CreateUserSchema } from '@schemas/user.schema';
import { userService } from '@services/user.service';
import { logger } from '@core/logger';
```

### Consistent Error Handling

```typescript
// src/exceptions/http-exceptions.ts
import { HTTPException } from 'hono/http-exception';

export class NotFoundError extends HTTPException {
  constructor(resource: string) {
    super(404, { message: `${resource} not found` });
  }
}

export class UnauthorizedError extends HTTPException {
  constructor() {
    super(401, { message: 'Unauthorized' });
  }
}
```

Throw these in services — Hono catches them automatically:

```typescript
if (!user) throw new NotFoundError('User');
```

### File Naming Conventions

| Type | Convention |
|------|-----------|
| Controllers | `user.controller.ts` |
| Services | `user.service.ts` |
| Schemas | `user.schema.ts` |
| Tests | `user.controller.test.ts` |
| Utils | `date.util.ts` |
| Crons | `cleanup.cron.ts` |


---

## The Benefits

**Single Source of Truth.** Need to add a `phoneNumber` field? One line in your schema:

```typescript
phoneNumber: z.string().optional() // ← One line added
```

Done. Your controller validates it, your docs show it, your tests expect it. No other files to touch.

**Type Safety.** TypeScript catches bugs at compile time, Zod catches them at runtime.

**Scalability.** Clear separation means teams can work on different layers without conflicts.

**Performance.** Hono handle thousands of requests per second with minimal resources.

**Testability.** Services are pure functions — easy to test without mocking HTTP.

**Documentation.** Always accurate because it's generated from the same schemas that validate requests.

---