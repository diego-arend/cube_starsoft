import { describe, it, expect } from "vitest";
import { createMultimodalAdapter } from "./createMultimodalAdapter";
import { MultimodalConfig } from "./schema";

describe("createMultimodalAdapter", () => {
  it("creates an OpenAI adapter with invoke and stream methods", () => {
    const model = createMultimodalAdapter({
      provider: "openai",
      apiKey: "test-key",
      modelName: "gpt-4o-mini",
      baseUrl: "https://api.openai.com/v1",
    });

    expect(model).toBeDefined();
    expect(typeof model.invoke).toBe("function");
    expect(typeof model.stream).toBe("function");
  });

  it("respects optional temperature and maxCompletionTokens", () => {
    const model = createMultimodalAdapter({
      provider: "openai",
      apiKey: "test-key",
      modelName: "gpt-4o",
      temperature: 0.2,
      maxCompletionTokens: 1024,
    });

    expect(model).toBeDefined();
    expect(typeof model.invoke).toBe("function");
  });

  it("respects optional reasoningEffort", () => {
    const model = createMultimodalAdapter({
      provider: "openai",
      apiKey: "test-key",
      modelName: "o1-mini",
      reasoningEffort: "high",
    });

    expect(model).toBeDefined();
  });

  it("throws for unsupported providers", () => {
    expect(() =>
      createMultimodalAdapter({
        provider: "unsupported",
        apiKey: "test-key",
        modelName: "test-model",
        baseUrl: "https://api.openai.com/v1",
      })
    ).toThrow("Unsupported Multimodal provider: unsupported");
  });

  it("throws when apiKey is empty (fail-fast validation)", () => {
    expect(() =>
      createMultimodalAdapter({
        provider: "openai",
        apiKey: "",
        modelName: "gpt-4o",
      } as unknown as MultimodalConfig)
    ).toThrow();
  });

  it("throws when modelName is empty", () => {
    expect(() =>
      createMultimodalAdapter({
        provider: "openai",
        apiKey: "test-key",
        modelName: "",
      } as unknown as MultimodalConfig)
    ).toThrow();
  });
});
