import { HTTPException } from "hono/http-exception";

export class NotFoundError extends HTTPException {
  constructor(resource: string) {
    super(404, { message: `${resource} not found` });
  }
}

export class BadRequestError extends HTTPException {
  constructor(message = "Bad request") {
    super(400, { message });
  }
}

export class UnauthorizedError extends HTTPException {
  constructor(message = "Unauthorized") {
    super(401, { message });
  }
}

export class ForbiddenError extends HTTPException {
  constructor(message = "Forbidden") {
    super(403, { message });
  }
}

export class ConflictError extends HTTPException {
  constructor(message = "Resource already exists") {
    super(409, { message });
  }
}

export class InternalServerError extends HTTPException {
  constructor(message = "Internal server error") {
    super(500, { message });
  }
}
