import {
  loginBodySchema,
  loginResponseSchema,
  refreshBodySchema,
} from "./schemas/schemas";

function extractDef(
  schema: unknown,
  name: string
): Record<string, unknown> | undefined {
  const s = schema as any;
  if (!s) return undefined;
  if (s.definitions && s.$ref) {
    const ref = String(s.$ref);
    const refName = ref.split("/").pop();
    if (refName && s.definitions[refName])
      return s.definitions[refName] as Record<string, unknown>;
  }
  if (s.definitions && s.definitions[name])
    return s.definitions[name] as Record<string, unknown>;
  if (typeof s === "object") return s as Record<string, unknown>;
  return undefined;
}

export const authComponents: Record<string, unknown> = {
  LoginBody: {
    ...(extractDef(loginBodySchema, "LoginBody") ?? {}),
    example: {
      email: "user@example.com",
      password: "correcthorsebatterystaple",
    },
  },
  LoginResponse: {
    ...(extractDef(loginResponseSchema, "LoginResponse") ?? {}),
    example: {
      accessToken: "eyJhbGciOiJI...",
      refreshToken: "rftkn_123",
      expiresIn: 3600,
      role: "user",
    },
  },
  RefreshBody: {
    ...(extractDef(refreshBodySchema, "RefreshBody") ?? {}),
    example: { refreshToken: "rftkn_123" },
  },
  SuccessResponse: {
    type: "object",
    properties: { success: { type: "boolean" } },
    example: { success: true },
  },
};
