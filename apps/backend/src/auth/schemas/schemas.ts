import { zodToJsonSchema } from "zod-to-json-schema";
import {
  LoginSchema,
  RefreshSchema,
  LoginResponseSchema,
} from "../dto/login.schema";

export const loginBodySchema = zodToJsonSchema(
  LoginSchema as unknown as Parameters<typeof zodToJsonSchema>[0],
  "LoginBody"
) as Record<string, unknown>;

export const loginResponseSchema = zodToJsonSchema(
  LoginResponseSchema as unknown as Parameters<typeof zodToJsonSchema>[0],
  "LoginResponse"
) as Record<string, unknown>;

export const refreshBodySchema = zodToJsonSchema(
  RefreshSchema as unknown as Parameters<typeof zodToJsonSchema>[0],
  "RefreshBody"
) as Record<string, unknown>;
