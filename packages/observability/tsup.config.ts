import { defineConfig } from "tsup";
import swc from "unplugin-swc";

export default defineConfig({
  entry: ["src/index.ts", "src/browser.ts", "src/nest.ts"],
  format: ["cjs", "esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: [
    "@nestjs/common",
    "@nestjs/core",
    "@nestjs/platform-express",
    "@nestjs/microservices",
    "rxjs",
    "rxjs/operators",
    "@opentelemetry/api",
    "@opentelemetry/instrumentation",
    "pino",
    "fastify"
  ],
  esbuildPlugins: [swc.esbuild()],
  // Keep decorators working
  tsconfig: "tsconfig.json",
});
