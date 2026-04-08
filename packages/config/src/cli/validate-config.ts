import fs from "fs";
import path from "path";
// We'll dynamically import the built package entry (dist) when running the CLI
// to avoid ESM resolution issues when executing TypeScript sources with ts-node.
import { pathToFileURL, fileURLToPath } from "url";
import type { ZodTypeAny } from "zod";

// `__dirname` and `__filename` are not available in ESM, define them from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Prefer the compiled ESM package entry if present (dist/index.js). This
  // ensures we import the ESM build when the package is declared as ESM.
  const distPath = path.resolve(__dirname, "../../dist/index.js");
  const loadPath = path.resolve(__dirname, "../../dist/load.js");

  let EnvSchema: ZodTypeAny;
  let loadConfig: () => Record<string, string>;

  try {
    if (fs.existsSync(distPath) && fs.existsSync(loadPath)) {
      const mod = await import(pathToFileURL(distPath).href);
      const loadMod = await import(pathToFileURL(loadPath).href);
      EnvSchema = mod.EnvSchema ?? mod.default?.EnvSchema ?? mod.default;
      loadConfig = loadMod.loadConfig;
    } else {
      throw new Error(`dist not built at ${distPath} or ${loadPath}`);
    }
  } catch (err) {
    console.error("Failed to load package from dist:", err);
    process.exit(1);
  }

  const config = loadConfig();
  const parsed = EnvSchema.safeParse(config);
  if (!parsed.success) {
    console.error("❌ Invalid configuration detected:");
    console.error(JSON.stringify(parsed.error.flatten().fieldErrors, null, 2));
    process.exit(1);
  }
  console.log("✅ Config is valid");
}

main();
