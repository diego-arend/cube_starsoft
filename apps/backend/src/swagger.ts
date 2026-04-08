import { INestApplication, Logger } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import { userComponents } from "./user/openapi";
import { authComponents } from "./auth/openapi";
import { sharedComponents } from "./shared/openapi";
import documentComponents from "./document/openapi";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import type { Env } from "@turborepo/config";

export function initSwagger(
  app: INestApplication,
  cfg: Partial<Env>
): OpenAPIObject | void {
  // Only enable in non-production when explicitly requested
  if (!cfg.SWAGGER_ENABLED || cfg.NODE_ENV === "production") return;
  const logger = new Logger("swagger");

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Turborepo SaaS API")
    .setDescription("API documentation for the Turborepo SaaS backend")
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
      "jwt"
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Apply global security requirement so the Bearer token entered in the
  // UI is actually used by "Try it out" requests.
  document.security = [{ jwt: [] }];
  // Ensure component schemas include the request/response models so they
  // appear under "Models" in the Swagger UI.
  document.components = document.components ?? {};

  document.components.schemas = {
    ...(document.components.schemas ?? {}),

    // module-provided schemas (merge per-module components)
    ...(authComponents ?? {}),
    ...(userComponents ?? {}),
    // document module's schemas (have a nested `schemas` key)
    ...((documentComponents && documentComponents.schemas) ?? {}),
    // shared components (centralized for reuse across modules)
    ...(sharedComponents ?? {}),
  } as any;

  // merge any examples exported by modules as well so they appear in the UI
  document.components.examples = {
    ...(document.components.examples ?? {}),
    ...((documentComponents && documentComponents.examples) ?? {}),
  } as any;

  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });
  logger.log("Swagger UI available at /docs (authorization persisted)");
  return document;
}
