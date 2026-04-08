import { describe, it, expect } from "vitest";
import { Test } from "@nestjs/testing";
import { vi } from "vitest";

// Some workspace packages are heavy to load during isolated tests; mock the
// rate-limit module so the AppModule can be loaded without resolving the
// package in Vitest/Vite's module loader.
vi.mock("@turborepo/rate-limit", () => ({
  RateLimitModule: { forRoot: () => ({ module: {} }) },
}));
import { APP_FILTER } from "@nestjs/core";

describe("AppModule provider overrides", () => {
  it("allows overriding APP_FILTER provider", async () => {
    const mock = { mockFilter: true };
    await expect(
      Test.createTestingModule({
        providers: [
          {
            provide: APP_FILTER,
            useClass: class {},
          },
        ],
      })
        .overrideProvider(APP_FILTER)
        .useValue(mock)
        .compile()
    ).resolves.not.toThrow();
  });
});
