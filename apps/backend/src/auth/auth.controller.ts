import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseGuards,
  Req,
  UseInterceptors,
} from "@nestjs/common";
import { Public } from "./decorators/public.decorator";
import { LoginRateLimitGuard } from "./guards/login-rate-limit.guard";
import type { FastifyRequest } from "fastify";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import {
  LoginSchema,
  RefreshSchema,
  LoginResponseSchema,
  type LoginDto,
  type RefreshDto,
} from "./dto/login.schema";
import { ZodValidationPipe } from "../shared/pipes/zod-validation.pipe";
import { ZodSerializerInterceptor } from "../shared/interceptors/zod-serializer.interceptor";

@Controller("auth")
@ApiTags("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("/login")
  @Public()
  @ApiOperation({ summary: "Login user and return access token" })
  @ApiResponse({
    status: 200,
    description: "Successful login",
    schema: { $ref: "#/components/schemas/LoginResponse" },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (validation failure)",
    schema: { $ref: "#/components/schemas/ErrorBadRequest" },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized (invalid credentials)",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  @ApiBody({ schema: { $ref: "#/components/schemas/LoginBody" } })
  @UseInterceptors(new ZodSerializerInterceptor(LoginResponseSchema))
  @UseGuards(LoginRateLimitGuard)
  async login(@Body(new ZodValidationPipe(LoginSchema as any)) body: LoginDto) {
    const { email, password } = body; // validated by ZodValidationPipe
    const result = await this.auth.login(email, password);
    return result;
  }

  @Post("/refresh")
  @Public()
  @ApiOperation({ summary: "Refresh access token using refresh token" })
  @ApiResponse({
    status: 200,
    description: "Token refreshed",
    schema: { $ref: "#/components/schemas/LoginResponse" },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request (validation failure)",
    schema: { $ref: "#/components/schemas/ErrorBadRequest" },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized (invalid or expired refresh token)",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  @ApiBody({ schema: { $ref: "#/components/schemas/RefreshBody" } })
  @UseInterceptors(new ZodSerializerInterceptor(LoginResponseSchema))
  async refresh(
    @Body(new ZodValidationPipe(RefreshSchema as any)) body: RefreshDto
  ) {
    const { refreshToken } = body; // validated by ZodValidationPipe
    const result = await this.auth.refreshToken(refreshToken);
    return result;
  }

  @Post("/logout")
  @ApiOperation({ summary: "Logout and revoke current access token" })
  @ApiResponse({
    status: 200,
    description: "Logout success",
    schema: { $ref: "#/components/schemas/SuccessResponse" },
  })
  @ApiResponse({
    status: 400,
    description: "Bad request",
    schema: { $ref: "#/components/schemas/ErrorBadRequest" },
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
    schema: { $ref: "#/components/schemas/ErrorUnauthorized" },
  })
  async logout(@Req() req: FastifyRequest) {
    // req.user is populated by JwtAuthGuard
    type RequestWithUser = FastifyRequest & {
      user?: { id?: string; jti?: string };
    };
    const user = (req as RequestWithUser).user;
    if (!user?.id || !user?.jti)
      throw new BadRequestException("Invalid request");
    const result = await this.auth.logout(user.id, user.jti);
    return result;
  }
}
