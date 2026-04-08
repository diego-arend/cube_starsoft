import { describe, it, expect } from "vitest";
import { ZodSerializerInterceptor } from "./zod-serializer.interceptor";
import { z } from "zod";
import { of, lastValueFrom } from "rxjs";
import type { ExecutionContext, CallHandler } from "@nestjs/common";

const schema = z.object({ id: z.string() });

const fakeExecutionContext = {
  switchToHttp: () => ({ getRequest: () => ({}) }),
} as unknown as ExecutionContext;

const fakeCallHandler = {
  handle: () => of({ id: "123" }),
} as unknown as CallHandler;

describe("ZodSerializerInterceptor", () => {
  it("serializes output using Zod schema", async () => {
    const interceptor = new ZodSerializerInterceptor(schema);
    const result$ = interceptor.intercept(
      fakeExecutionContext,
      fakeCallHandler
    );
    const res = await lastValueFrom(result$);
    expect(res).toEqual({ id: "123" });
  });
});
