import { describe, it, expect } from "vitest";
import {
  UserSchema,
  CreateUserSchema,
  UpdateUserSchema,
} from "../../../dto/user.dto";

describe("User DTOs (Zod)", () => {
  it("parses a valid user object with dates", () => {
    const payload = {
      id: "00000000-0000-0000-0000-000000000000",
      email: "test@example.com",
      name: "Test User",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      role: "USER",
    };

    const parsed = UserSchema.parse(payload);
    expect(parsed.id).toBe(payload.id);
    expect(parsed.email).toBe(payload.email);
    expect(parsed.name).toBe(payload.name);
    expect(parsed.createdAt instanceof Date).toBeTruthy();
  });

  it("validates CreateUserSchema and rejects invalid email", () => {
    expect(() => CreateUserSchema.parse({ email: "invalid-email" })).toThrow();
  });

  it("accepts partial update schema", () => {
    const data = { name: "New name" };
    const parsed = UpdateUserSchema.parse(data);
    expect(parsed.name).toBe("New name");
  });
});
