import { describe, it, expect, vi } from "vitest";
import { Test } from "@nestjs/testing";
import { initSwagger } from "../../swagger";
import type { Env } from "@turborepo/config/node";

describe("Swagger integration", () => {
  it("registers auth schemas with examples and security", async () => {
    // Mock the login rate limit guard module to avoid importing workspace packages
    vi.mock("../../auth/guards/login-rate-limit.guard", () => ({
      LoginRateLimitGuard: class {},
    }));

    const { AuthController } = await import("../../auth/auth.controller");
    const { AuthService } = await import("../../auth/auth.service");
    const { UserController } = await import("../../user/user.controller");
    const { UserService } = await import("../../user/user.service");

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController, UserController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: () => ({ accessToken: "a", expiresIn: 3600 }),
            refreshToken: () => ({ accessToken: "a", expiresIn: 3600 }),
            logout: () => ({ success: true }),
          },
        },
        {
          provide: UserService,
          useValue: {
            create: () => ({ id: "u", email: "a@b.com" }),
            findAll: () => [],
            findOneById: () => null,
            update: () => ({ id: "u", email: "a@b.com" }),
            remove: () => ({ success: true }),
          },
        },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const cfg: Partial<Env> = {
      SWAGGER_ENABLED: true,
      NODE_ENV: "development",
    };

    const doc = initSwagger(app, cfg) as any;
    expect(doc).toBeDefined();
    const schemas = doc.components?.schemas;
    expect(schemas).toBeDefined();
    expect(schemas.LoginBody).toBeDefined();
    expect(schemas.LoginBody.example).toBeDefined();
    expect(schemas.LoginResponse).toBeDefined();
    expect(schemas.LoginResponse.example).toBeDefined();
    expect(schemas.ErrorResponse).toBeDefined();
    expect(schemas.ErrorResponse.example).toBeDefined();
    // module-provided user schemas
    expect(schemas.CreateUser).toBeDefined();
    expect(schemas.CreateUser.example).toBeDefined();
    expect(schemas.UpdateUser).toBeDefined();
    expect(schemas.UpdateUser.example).toBeDefined();

    // ensure endpoints document error responses
    const loginResp = doc.paths?.["/auth/login"]?.post?.responses;
    expect(
      loginResp["400"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorBadRequest");
    expect(
      loginResp["401"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorUnauthorized");

    const refreshResp = doc.paths?.["/auth/refresh"]?.post?.responses;
    expect(
      refreshResp["400"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorBadRequest");
    expect(
      refreshResp["401"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorUnauthorized");

    // examples contain codes that match the response type
    expect(schemas.ErrorUnauthorized.example.code).toBe("UNAUTHORIZED");
    expect(schemas.ErrorBadRequest.example.code).toBe("BAD_REQUEST");

    expect(doc.security).toEqual([{ jwt: [] }]);

    // user endpoints error responses
    const createResp = doc.paths?.["/users"]?.post?.responses;
    expect(
      createResp["400"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorBadRequest");
    expect(
      createResp["409"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorConflict");
    expect(schemas.ErrorConflict.example.code).toBe("CONFLICT");

    const getResp = doc.paths?.["/users/{id}"]?.get?.responses;
    expect(getResp["401"]?.content["application/json"]?.schema?.["$ref"]).toBe(
      "#/components/schemas/ErrorUnauthorized"
    );
    expect(getResp["404"]?.content["application/json"]?.schema?.["$ref"]).toBe(
      "#/components/schemas/ErrorNotFound"
    );
    expect(schemas.ErrorNotFound.example.code).toBe("NOT_FOUND");

    const patchResp = doc.paths?.["/users/{id}"]?.patch?.responses;
    expect(
      patchResp["400"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorBadRequest");
    expect(
      patchResp["401"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorUnauthorized");
    expect(
      patchResp["404"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorNotFound");

    const deleteResp = doc.paths?.["/users/{id}"]?.delete?.responses;
    expect(
      deleteResp["401"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorUnauthorized");
    expect(
      deleteResp["404"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorNotFound");

    // auth logout responses
    const logoutResp = doc.paths?.["/auth/logout"]?.post?.responses;
    expect(
      logoutResp["200"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/SuccessResponse");
    expect(
      logoutResp["400"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorBadRequest");
    expect(
      logoutResp["401"]?.content["application/json"]?.schema?.["$ref"]
    ).toBe("#/components/schemas/ErrorUnauthorized");

    await app.close();
  });
});
