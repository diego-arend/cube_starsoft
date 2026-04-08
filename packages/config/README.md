# @turborepo/config

## Purpose

Centralized, typed configuration validator and loader for the monorepo. This package uses a repository-level `config.yaml` as the single source of truth. It defines the `EnvSchema` (Zod) and provides utilities to generate per-application `.env` files.

Important: Applications generate their own local `.env` files from `config.yaml`. Packages do NOT load environment variables themselves; they must receive configuration via Dependency Injection to remain decoupled.

## Key exports

- `EnvSchema` — Zod schema used to validate current environment variables.
- `Env` — TypeScript type inferred from the package's Zod schema.
- `createNestConfigModule()` — NestJS `DynamicModule` helper for applications.
- `createNestConfigLoad()` — Loader function for NestJS `ConfigModule`.
- `generate-frontend-env` — CLI script to generate `.env` for `apps/frontend`.
- `generate-backend-env` — CLI script to generate `.env` for `apps/backend`.
- `generate-worker-env` — CLI script to generate `.env` for `apps/backend-worker-notification`.

## Browser Support (Next.js)

The package provides a `typedEnv` object (exported as `env`) that is safe to use in the browser. It automatically maps `NEXT_PUBLIC_` variables to their canonical names.

For example, `env.OTEL_ENABLED` will read from `process.env.NEXT_PUBLIC_OTEL_ENABLED` in the browser context.

## Frontend Environment Generation

1.  **Generation**: Run `pnpm generate-envs` (or just `pnpm dev`/`pnpm build`) to project `config.yaml` into local `.env` files.
2.  **Loading**: Each app uses its `src/env.ts` to load `.env` (via `dotenv`) and validate it using `EnvSchema`.
3.  **Packages**: Instead of calling global config methods, packages define their modules/services to accept a typed `Env` object:
    ```typescript
    // Example in a package module
    @Module({})
    export class MyPackageModule {
      static forRoot(cfg: Env): DynamicModule { ... }
    }
    ```

## Frontend Environment Generation

To maintain a single source of truth while satisfying Next.js's requirements, this package filters variables based on explicit annotations in `packages/config/src/schema.ts`.

#### Annotating a key for frontend export

Add an entry to `EnvAnnotations`. Example:

```ts
export const EnvAnnotations = {
  NEXT_PUBLIC_API_URL: {
    safeForFrontend: true,
    description: "Public API URL used by the browser",
  },
};
```

**Important**: If you want a key to be available in the browser, you must add `safeForFrontend: true` and a `description`.

## Adding new Variables

1.  **Update `config.yaml`**: Add the new key.
2.  **Update Schema**: Adjust `EnvSchema` in `packages/config/src/schema.ts`.
3.  **Frontend mapping**: If it's for the browser, add an entry to `EnvAnnotations`.
4.  **Regenerate**: Run `pnpm generate-envs` (triggered automatically by `pnpm dev`).

## Validation and CI

- Run `pnpm run validate` to verify `config.yaml` against the schema.
- Include this in CI to catch missing or malformed configuration early.

## Extending the schema

1. Add or adjust keys in `EnvSchema` at `packages/config/src/index.ts`.
2. Rebuild and run the validation script to confirm changes.
3. Update any consumers that rely on the new keys.

## Common key categories

- `PORT`, `NODE_ENV` — server settings
- `DATABASE_*` — database connection settings
- `REDIS_*` — caching and rate-limiter backends
- `LOG_*` — logging configuration
- `RATE_LIMIT_*` — rate limiter parameters
  - Note: `RATE_LIMIT_MAX_REQUESTS` is required. It can be provided in `config.yaml` as `server.rate_limit.max_requests` or as env var `RATE_LIMIT_MAX_REQUESTS`.
- `JWT_SECRET`, `JWT_EXPIRES_IN` — JWT signing secret and access token TTL (seconds)

## Next.js & Edge Runtime Compatibility

This package provides two entry points to handle the differences between Node.js and Edge Runtime (Middleware):

1.  **`@turborepo/config/load` (Node.js only)**:
    - Exports `loadConfig()`.
    - Uses `fs` to read `config.yaml` from disk.
    - **Usage**: Must be used in `next.config.ts` to read the configuration and inject it into `process.env` during the build/startup phase.

2.  **`@turborepo/config` (Universal/Edge compatible)**:
    - Exports `typedEnv`.
    - Reads from `process.env` (which was populated by the step above).
    - Does **not** use `fs`.
    - **Usage**: Use this in your application code, API routes, and Middleware.

**Why this separation?**
The Edge Runtime (used by Next.js Middleware) does not have access to the file system (`fs`). If we tried to read `config.yaml` directly in the middleware, the app would crash. By loading the config in `next.config.ts` (Node.js) and passing it via `process.env`, we ensure the configuration is available everywhere without breaking the Edge Runtime.

## Troubleshooting

- Validation failures show which key or value is invalid — check `config.yaml` and generated `.env` files.
- Remember: Packages receive config via DI, only Apps import `typedEnv` from their own `src/env.ts` or `@turborepo/config`.

## Notes

- Keep `EnvSchema` stable; other packages depend on the typed shape in runtime and compile-time checks.

# @turborepo/config
