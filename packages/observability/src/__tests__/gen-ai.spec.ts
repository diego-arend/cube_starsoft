import { describe, it, expect, vi, beforeEach } from "vitest";
import { metrics } from "@opentelemetry/api";
import {
  resolveServerAddress,
  withGenAISpan,
  recordGenAITokenUsage,
} from "../gen-ai-instrumentation";

describe("resolveServerAddress", () => {
  it("returns api.openai.com when baseUrl is undefined", () => {
    expect(resolveServerAddress(undefined)).toBe("api.openai.com");
  });

  it("returns api.openai.com when baseUrl is empty string", () => {
    expect(resolveServerAddress("")).toBe("api.openai.com");
  });

  it("extracts hostname from HTTPS URL with path", () => {
    expect(resolveServerAddress("https://api.openai.com/v1/embeddings")).toBe(
      "api.openai.com"
    );
  });

  it("extracts hostname from HTTP localhost URL", () => {
    expect(resolveServerAddress("http://localhost:8000/transcriptions")).toBe(
      "localhost"
    );
  });

  it("returns api.openai.com for an invalid URL string", () => {
    expect(resolveServerAddress("not-a-valid-url")).toBe("api.openai.com");
  });
});

describe("withGenAISpan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the value produced by fn", async () => {
    const result = await withGenAISpan(
      "embeddings",
      "test-model",
      "openai",
      {},
      async () => 42
    );
    expect(result).toBe(42);
  });

  it("propagates errors thrown inside fn", async () => {
    await expect(
      withGenAISpan("chat", "gpt-4o", "openai", {}, async () => {
        throw new Error("API failure");
      })
    ).rejects.toThrow("API failure");
  });

  it("records gen_ai.client.operation.duration on success", async () => {
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createHistogram: vi.fn().mockReturnValue(mockHistogram),
    };
    const getMeterSpy = vi
      .spyOn(metrics, "getMeter")
      .mockReturnValue(mockMeter as never);

    await withGenAISpan(
      "embeddings",
      "text-embedding-3-small",
      "openai",
      { "server.address": "api.openai.com" },
      async () => "ok"
    );

    expect(getMeterSpy).toHaveBeenCalledWith("gen-ai-client");
    expect(mockMeter.createHistogram).toHaveBeenCalledWith(
      "gen_ai.client.operation.duration",
      expect.any(Object)
    );
    expect(mockHistogram.record).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({
        "gen_ai.operation.name": "embeddings",
        "gen_ai.provider.name": "openai",
        "gen_ai.request.model": "text-embedding-3-small",
        "server.address": "api.openai.com",
      })
    );

    getMeterSpy.mockRestore();
  });

  it("includes error.type in the duration metric on failure", async () => {
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createHistogram: vi.fn().mockReturnValue(mockHistogram),
    };
    const getMeterSpy = vi
      .spyOn(metrics, "getMeter")
      .mockReturnValue(mockMeter as never);

    await expect(
      withGenAISpan("chat", "gpt-4o", "openai", {}, async () => {
        throw new TypeError("bad request");
      })
    ).rejects.toThrow("bad request");

    expect(mockHistogram.record).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ "error.type": "TypeError" })
    );

    getMeterSpy.mockRestore();
  });

  it("uses server.address from attributes in metric labels", async () => {
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createHistogram: vi.fn().mockReturnValue(mockHistogram),
    };
    const getMeterSpy = vi
      .spyOn(metrics, "getMeter")
      .mockReturnValue(mockMeter as never);

    await withGenAISpan(
      "stt",
      "whisper-1",
      "whisper-local",
      { "server.address": "localhost" },
      async () => "transcript"
    );

    expect(mockHistogram.record).toHaveBeenCalledWith(
      expect.any(Number),
      expect.objectContaining({ "server.address": "localhost" })
    );

    getMeterSpy.mockRestore();
  });
});

describe("recordGenAITokenUsage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records input tokens with gen_ai.token.type=input", () => {
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createHistogram: vi.fn().mockReturnValue(mockHistogram),
    };
    const getMeterSpy = vi
      .spyOn(metrics, "getMeter")
      .mockReturnValue(mockMeter as never);

    recordGenAITokenUsage({
      operation: "embeddings",
      provider: "openai",
      requestModel: "text-embedding-3-small",
      responseModel: "text-embedding-3-small",
      inputTokens: 100,
    });

    expect(getMeterSpy).toHaveBeenCalledWith("gen-ai-client");
    expect(mockHistogram.record).toHaveBeenCalledOnce();
    expect(mockHistogram.record).toHaveBeenCalledWith(
      100,
      expect.objectContaining({
        "gen_ai.token.type": "input",
        "gen_ai.operation.name": "embeddings",
        "gen_ai.provider.name": "openai",
        "gen_ai.request.model": "text-embedding-3-small",
        "gen_ai.response.model": "text-embedding-3-small",
      })
    );

    getMeterSpy.mockRestore();
  });

  it("records both input and output tokens when both are provided", () => {
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createHistogram: vi.fn().mockReturnValue(mockHistogram),
    };
    const getMeterSpy = vi
      .spyOn(metrics, "getMeter")
      .mockReturnValue(mockMeter as never);

    recordGenAITokenUsage({
      operation: "chat",
      provider: "openai",
      requestModel: "gpt-4o",
      responseModel: "gpt-4o-2024-08-06",
      inputTokens: 512,
      outputTokens: 180,
    });

    expect(mockHistogram.record).toHaveBeenCalledTimes(2);
    expect(mockHistogram.record).toHaveBeenCalledWith(
      512,
      expect.objectContaining({ "gen_ai.token.type": "input" })
    );
    expect(mockHistogram.record).toHaveBeenCalledWith(
      180,
      expect.objectContaining({ "gen_ai.token.type": "output" })
    );

    getMeterSpy.mockRestore();
  });

  it("does not record when tokens are undefined or zero", () => {
    const mockHistogram = { record: vi.fn() };
    const mockMeter = {
      createHistogram: vi.fn().mockReturnValue(mockHistogram),
    };
    const getMeterSpy = vi
      .spyOn(metrics, "getMeter")
      .mockReturnValue(mockMeter as never);

    recordGenAITokenUsage({
      operation: "chat",
      provider: "openai",
      requestModel: "gpt-4o",
      responseModel: "gpt-4o",
    });

    expect(mockHistogram.record).not.toHaveBeenCalled();

    getMeterSpy.mockRestore();
  });
});
