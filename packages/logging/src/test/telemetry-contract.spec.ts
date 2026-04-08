import { describe, it, expect, vi } from "vitest";
import { HttpLogContractSchema, type HttpLogContract } from "../types";
import { createLogger, type EnhancedLogger } from "../logger";
import { NestPinoLogger } from "../nest/logger";

describe("Telemetry Data Contract (v1.0)", () => {
  describe("Schema Validation (Zod)", () => {
    it("should accept a valid OTel-compliant log object", () => {
      const validData: HttpLogContract = {
        "http.method": "GET",
        "http.url": "/health",
        "http.status_code": 200,
        msg: "Request finished",
      };

      const result = HttpLogContractSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it("should reject if 'http.method' is missing", () => {
      const invalidData = {
        "http.url": "/health",
        "http.status_code": 200,
        msg: "Request finished",
      };

      const result = HttpLogContractSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it("should reject if 'http.status_code' is not a number", () => {
      const invalidData = {
        "http.method": "GET",
        "http.url": "/health",
        "http.status_code": "200", // string instead of number
        msg: "Request finished",
      };

      const result = HttpLogContractSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe("EnhancedLogger Implementation", () => {
    it("should throw error when calling httpResponse with invalid data", () => {
      const logger = createLogger({ level: "silent" });
      const invalidData = {
        "http.method": "GET",
        // missing http.url
        "http.status_code": 200,
        msg: "Missing URL",
      } as unknown as HttpLogContract;

      expect(() => logger.httpResponse(invalidData)).toThrow();
    });

    it("should successfully log when calling httpResponse with valid data", () => {
      const logger = createLogger({ level: "silent" });
      const validData: HttpLogContract = {
        "http.method": "POST",
        "http.url": "/api/test",
        "http.status_code": 201,
        msg: "Created",
      };

      expect(() => logger.httpResponse(validData)).not.toThrow();
    });
  });

  describe("NestPinoLogger Automatic Detection", () => {
    it("should automatically detect and validate contract via .log()", () => {
      const logger = new NestPinoLogger({ level: "silent" });

      // We want to verify that it uses httpResponse when it sees http.method
      // We can spy on the underlying logger's info method (which httpResponse uses)
      const internalLogger = (logger as unknown as { logger: EnhancedLogger })
        .logger;
      const infoSpy = vi.spyOn(internalLogger, "info");

      logger.log({
        "http.method": "GET",
        "http.url": "/auto-detect",
        "http.status_code": 200,
        msg: "Detected",
      });

      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          "http.method": "GET",
          "http.url": "/auto-detect",
          "http.status_code": 200,
        })
      );
    });

    it("should fallback to normal log if contract is invalid in .log()", () => {
      const logger = new NestPinoLogger({ level: "silent" });
      const internalLogger = (logger as unknown as { logger: EnhancedLogger })
        .logger;
      const infoSpy = vi.spyOn(internalLogger, "info");

      // Invalid contract (missing http.url) but contains http.method
      const invalidContract = {
        "http.method": "GET",
        "http.status_code": 200,
        msg: "Invalid but has method",
      };

      logger.log(invalidContract);

      // It should NOT call httpResponse (which validates) but still log as regular object
      expect(infoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          "http.method": "GET",
          "http.status_code": 200,
          msg: "Invalid but has method",
        })
      );
    });
  });
});
