import { vi } from "vitest";
import { Logger } from "@nestjs/common";

// Silence nest Logger.error for all tests to avoid noisy console output.
// Tests that need to assert logger calls should set their own spies.
vi.spyOn(Logger.prototype, "error").mockImplementation(() => void 0);
