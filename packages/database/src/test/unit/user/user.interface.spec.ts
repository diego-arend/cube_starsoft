import { describe, it, expect } from "vitest";
import type { User } from "../../../interfaces/user.interface";

describe("User Interface typing (compile-time)", () => {
  it("allows a shape compatible with User interface", () => {
    const user: User = {
      id: "00000000-0000-0000-0000-000000000000",
      email: "test@example.com",
      name: "Test",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(user.email).toBe("test@example.com");
  });
});
