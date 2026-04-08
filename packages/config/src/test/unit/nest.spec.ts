import { describe, it, expect, vi } from "vitest";

describe("createNestConfigModule", () => {
  it("exports a function that returns a module object or a promise that resolves to one", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const cfgPath = path.resolve(process.cwd(), "config.yaml");
    const wrote = !fs.existsSync(cfgPath);
    if (wrote) {
      const minimal = `JWT_SECRET: testsecret\nJWT_REFRESH_SECRET: refreshsecret\nJWT_EXPIRES_IN: 3600\nJWT_REFRESH_EXPIRES_IN: 604800\n`;
      fs.writeFileSync(cfgPath, minimal);
    }
    try {
      const repoCfg = path.resolve(process.cwd(), "config.yaml");
      const orig = fs.readFileSync(repoCfg, "utf8");
      const needsPatch =
        !orig.includes("JWT_SECRET") || !orig.includes("JWT_EXPIRES_IN");
      if (needsPatch) {
        const patched =
          `JWT_SECRET: testsecret\nJWT_REFRESH_SECRET: refreshsecret\nJWT_EXPIRES_IN: 3600\nJWT_REFRESH_EXPIRES_IN: 604800\n` +
          orig;
        fs.writeFileSync(repoCfg, patched);
      }
      try {
        // Ensure a fresh import (clear module cache) so the package will re-parse
        // the newly-written `config.yaml` during import.
        vi.resetModules();
        const mod = await import("../../nest");
        const createNestConfigModule = mod.createNestConfigModule;
        expect(typeof createNestConfigModule).toBe("function");
        const result = createNestConfigModule();
        const m = result instanceof Promise ? await result : result;
        expect(typeof m).toBe("object");
        // Expect keys common to a Nest DynamicModule
        expect(m).toHaveProperty("module");
      } finally {
        if (needsPatch) fs.writeFileSync(repoCfg, orig);
      }
    } finally {
      if (wrote) fs.unlinkSync(cfgPath);
    }
  });
});
