import { describe, it, expect } from "vitest";
import { ZodValidationPipe } from "./zod-validation.pipe";
import { z } from "zod";

describe("ZodValidationPipe", () => {
  it("accepts valid payloads", () => {
    const schema = z.object({ name: z.string() });
    const pipe = new ZodValidationPipe(schema);
    const result = pipe.transform(
      { name: "test" },
      { type: "body" as any, metatype: undefined as any, data: undefined }
    );
    expect(result).toEqual({ name: "test" });
  });

  it("throws on invalid payloads", () => {
    const schema = z.object({ name: z.string() });
    const pipe = new ZodValidationPipe(schema);
    expect(() =>
      pipe.transform(
        { wrong: true },
        { type: "body" as any, metatype: undefined as any, data: undefined }
      )
    ).toThrow();
  });
});
