import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseYamlToFlatEnv } from "./parser";

// Determine directory in a way that works both for CJS (`__dirname`) and ESM
function getThisDir(): string {
  try {
    // ESM runtime
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    // CJS fallback (when compiled to CommonJS and executed as CJS)
    return typeof __dirname !== "undefined" ? __dirname : process.cwd();
  }
}

function findConfigFile(): string | undefined {
  try {
    const base = getThisDir();
    const guesses = [
      path.resolve(base, "../../..", "config.yaml"),
      path.resolve(process.cwd(), "config.yaml"),
      path.resolve(process.cwd(), "../../config.yaml"),
      path.resolve(base, "../../../config.yaml"),
    ];
    for (const g of guesses) {
      if (fs.existsSync(g)) return g;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export function loadConfig(): Record<string, string> {
  const rootConfigPath = findConfigFile();
  if (rootConfigPath && rootConfigPath.endsWith("config.yaml")) {
    const raw = fs.readFileSync(rootConfigPath, "utf8");
    return parseYamlToFlatEnv(raw);
  }
  return {};
}
