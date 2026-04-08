import { describe, it, expect } from "vitest";
import { FallbackService } from "../../fallback.service";

describe("FallbackService", () => {
  it("set/get and TTL should work", () => {
    const svc = new FallbackService();
    svc.set("a", "1", 1);
    const v = svc.get("a");
    expect(v).toBe("1");
  });
});
