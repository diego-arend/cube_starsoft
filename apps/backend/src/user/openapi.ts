export const userComponents: Record<string, unknown> = {
  CreateUser: {
    type: "object",
    properties: {
      email: { type: "string", format: "email", example: "user@example.com" },
      name: { type: "string", example: "User" },
      password: { type: "string", example: "correcthorsebatterystaple" },
    },
    required: ["email", "password"],
    example: {
      email: "user@example.com",
      name: "User",
      password: "correcthorsebatterystaple",
    },
  },

  UpdateUser: {
    type: "object",
    properties: {
      name: { type: "string", example: "New Name" },
    },
    example: { name: "New Name" },
  },

  UserPublic: {
    type: "object",
    properties: {
      id: { type: "string", example: "user_1" },
      email: { type: "string", format: "email", example: "user@example.com" },
      name: { type: "string", example: "User" },
    },
    example: { id: "user_1", email: "user@example.com", name: "User" },
  },

  UserListPaginated: {
    type: "object",
    properties: {
      data: {
        type: "array",
        items: { $ref: "#/components/schemas/UserPublic" },
      },
      meta: { $ref: "#/components/schemas/PaginationMeta" },
    },
    example: {
      data: [{ id: "user_1", email: "user@example.com", name: "User" }],
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    },
  },
};
