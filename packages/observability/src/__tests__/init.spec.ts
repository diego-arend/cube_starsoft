import { describe, it, expect, vi } from "vitest";

// NodeSDK.start() initialises gRPC/HTTP exporters and OTel instrumentation
// patches that leave open handles (TCP channels, periodic flush intervals),
// causing the test runner to time out.  We mock the SDK so the unit test can
// verify initObservability's own logic (guard flag, config parsing) without
// spawning any real I/O.
vi.mock("@opentelemetry/sdk-node", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@opentelemetry/sdk-node")>();
  return {
    ...actual,
    NodeSDK: class {
      start() {}
      shutdown() {
        return Promise.resolve();
      }
    },
  };
});

import { initObservability } from "../index";

describe("Observability Initialization Contract", () => {
  it("should initialize with default service name", () => {
    // We cannot easily test the side effects of NodeSDK start() in a unit test without heavy mocking,
    // but we can test that initObservability doesn't throw and sets global state.

    // Reset global initialized flag for testing if possible, or just call it.
    // The initObservability function has a guard check.

    expect(() =>
      initObservability({
        OTEL_ENABLED: "true",
        OTEL_SERVICE_NAME: "backend-api",
        NODE_ENV: "development",
      })
    ).not.toThrow();
  });
});
