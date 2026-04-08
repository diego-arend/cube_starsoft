import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock fetch globally
global.fetch = vi.fn();

// Mock window.URL.createObjectURL and revokeObjectURL
if (typeof window !== "undefined") {
  window.URL.createObjectURL = vi.fn(() => "mock-url");
  window.URL.revokeObjectURL = vi.fn();
}
