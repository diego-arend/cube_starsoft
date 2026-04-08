// Minimal ambient declaration so TypeScript won't error when the
// optional dependency isn't installed in some environments (tests, CI, etc.).
// This provides a very small surface that we use in `main.ts`.

declare module "@fastify/multipart" {
  import type { FastifyPluginCallback } from "fastify";
  const plugin: FastifyPluginCallback<any>;
  export default plugin;
}
