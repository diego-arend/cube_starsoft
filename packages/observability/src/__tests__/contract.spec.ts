import { describe, it, expect, vi, beforeEach } from "vitest";
import { metrics } from "@opentelemetry/api";
import { recordWorkerJob } from "../index";

describe("Observability Contract (v1.0)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Worker Metrics", () => {
    it("should be able to record worker jobs", () => {
      // Mocking OTEL metrics
      const mockCounter = { add: vi.fn() };
      const mockMeter = { createCounter: vi.fn().mockReturnValue(mockCounter) };
      const getMeterSpy = vi
        .spyOn(metrics, "getMeter")
        .mockReturnValue(mockMeter as never);

      recordWorkerJob("success");

      expect(getMeterSpy).toHaveBeenCalledWith("worker");
      expect(mockMeter.createCounter).toHaveBeenCalledWith(
        "worker_jobs_total",
        expect.any(Object)
      );
      expect(mockCounter.add).toHaveBeenCalledWith(1, { status: "success" });

      recordWorkerJob("error");
      expect(mockCounter.add).toHaveBeenCalledWith(1, { status: "error" });
    });
  });
});
