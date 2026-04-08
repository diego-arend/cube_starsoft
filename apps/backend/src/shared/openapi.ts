export const sharedComponents: Record<string, unknown> = {
  ErrorResponse: {
    type: "object",
    properties: {
      message: { type: "string" },
      code: { type: "string" },
      details: { type: "object", additionalProperties: true },
    },
    example: {
      message: "Invalid request",
      code: "BAD_REQUEST",
      details: { field: "email", issue: "invalid format" },
    },
  },
  ErrorBadRequest: {
    type: "object",
    properties: {
      message: { type: "string" },
      code: { type: "string" },
      details: { type: "object", additionalProperties: true },
    },
    example: {
      message: "Invalid request",
      code: "BAD_REQUEST",
      details: { field: "email", issue: "invalid format" },
    },
  },
  ErrorUnauthorized: {
    type: "object",
    properties: {
      message: { type: "string" },
      code: { type: "string" },
      details: { type: "object", additionalProperties: true },
    },
    example: { message: "Unauthorized", code: "UNAUTHORIZED", details: {} },
  },
  ErrorForbidden: {
    type: "object",
    properties: {
      message: { type: "string" },
      code: { type: "string" },
      details: { type: "object", additionalProperties: true },
    },
    example: { message: "Forbidden", code: "FORBIDDEN", details: {} },
  },
  ErrorNotFound: {
    type: "object",
    properties: {
      message: { type: "string" },
      code: { type: "string" },
      details: { type: "object", additionalProperties: true },
    },
    example: { message: "Not found", code: "NOT_FOUND", details: {} },
  },
  ErrorConflict: {
    type: "object",
    properties: {
      message: { type: "string" },
      code: { type: "string" },
      details: { type: "object", additionalProperties: true },
    },
    example: { message: "Conflict", code: "CONFLICT", details: {} },
  },
  PaginationMeta: {
    type: "object",
    properties: {
      total: { type: "number" },
      page: { type: "number" },
      limit: { type: "number" },
      pages: { type: "number" },
    },
    example: { total: 100, page: 1, limit: 20, pages: 5 },
  },
};
