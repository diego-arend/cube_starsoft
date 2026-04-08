import { z } from "zod";
import { UserRole } from "../enums/user-role.enum";

// Preprocess to accept either string or Date and normalize to Date object
const datePreprocess = z.preprocess((val: unknown) => {
  if (typeof val === "string" || val instanceof Date) return new Date(val);
  return val;
}, z.date());

export const UserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string().optional(),
  passwordHash: z.string().nullable().optional(),
  createdAt: datePreprocess,
  updatedAt: datePreprocess,
  role: z.nativeEnum(UserRole),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().nullable().optional(),
  password: z.string().min(8).optional(),
  // Allow creating users with a role via API (optional) — the service layer
  // should enforce whether this is allowed (e.g., only admins).
  role: z.nativeEnum(UserRole).optional(),
});

export const UpdateUserSchema = CreateUserSchema.partial();

export type UserDto = z.infer<typeof UserSchema>;
export type CreateUserDto = z.infer<typeof CreateUserSchema>;
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

// Public user schema for API responses (omits sensitive fields)
export const UserPublicSchema = UserSchema.omit({ passwordHash: true });
export type UserPublicDto = z.infer<typeof UserPublicSchema>;
