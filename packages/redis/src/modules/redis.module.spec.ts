import { describe, it, expect, afterAll } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import { Module } from "@nestjs/common";
import { RedisModule } from "../modules/redis.module";
import { RedisService } from "../redis.service";
import type { Env } from "@turborepo/config";

const mockEnv = { REDIS_ENABLED: false } as unknown as Env;

describe("RedisModule singleton behavior", () => {
  it("should only register a single RedisService provider even if forRoot() is called multiple times", async () => {
    @Module({ imports: [RedisModule.forRoot(mockEnv)] })
    class ModA {}

    @Module({ imports: [RedisModule.forRoot(mockEnv)] })
    class ModB {}

    const testingModule: TestingModule = await Test.createTestingModule({
      imports: [ModA, ModB],
    }).compile();

    // Access internal Nest container to count providers of type RedisService
    const modules = (
      testingModule as unknown as {
        container: {
          getModules: () => Map<
            unknown,
            { providers: Map<unknown, { metatype?: unknown }> }
          >;
        };
      }
    ).container.getModules();
    let found = 0;
    for (const [, mod] of modules) {
      const providers: Map<unknown, { metatype?: unknown }> = mod.providers;
      for (const [, prov] of providers) {
        const mt = prov.metatype;
        if (mt === RedisService) found += 1;
      }
    }

    expect(found).toBe(1);

    // Also ensure the RedisService is resolvable from the testing module
    const instance = testingModule.get(RedisService, { strict: false });
    expect(instance).toBeDefined();

    await testingModule.close();
    // reset the module initialization state so other tests aren't affected by
    // this test (it calls forRoot() multiple times).
    (RedisModule as unknown as { _initialized?: boolean })._initialized = false;
  });
});

afterAll(() => {
  // cleanup env changes if any other tests depend on defaults

  delete process.env.REDIS_ENABLED;
});
