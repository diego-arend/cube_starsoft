import { describe, it, expect } from "vitest";
import { UserEntity } from "../../../entities/user.entity";

describe("UserEntity", () => {
  it("can be instantiated and fields set", () => {
    const user = new UserEntity();
    user.email = "test@example.com";
    user.name = "Tester";
    expect(user.email).toBe("test@example.com");
    expect(user.name).toBe("Tester");
  });

  it("generates a v7 uuid before insert when id is not provided", () => {
    const user = new UserEntity();
    expect(user.id).toBeUndefined();
    user.ensureId();
    expect(typeof user.id).toBe("string");
    // UUID format: xxxxxxxx-xxxx-Mxxx-Nxxx-xxxxxxxxxxxx. Version is at index 14
    expect(user.id.length).toBe(36);
    expect(user.id[14]).toBe("7");
  });

  it("does not overwrite an existing id", () => {
    const user = new UserEntity();
    user.id = "00000000-0000-7000-0000-000000000000"; // valid v7 style with 7 in position
    user.ensureId();
    expect(user.id).toBe("00000000-0000-7000-0000-000000000000");
  });
});
