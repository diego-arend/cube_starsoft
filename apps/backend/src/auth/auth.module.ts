import { Module, DynamicModule } from "@nestjs/common";
import { DatabaseModule, UserEntity } from "@turborepo/database";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./guards/auth.guard";
import { JwtAuthStrategy } from "./strategies/jwt.strategy";
import { LoginRateLimitGuard } from "./guards/login-rate-limit.guard";
import { RolesGuard } from "./guards/roles.guard";
import { RedisService } from "@turborepo/redis";

@Module({})
export class AuthModule {
  static forRoot(): DynamicModule {
    return {
      module: AuthModule,
      // `RedisModule` is a global module and should be initialized once at the
      // application root. Avoid calling `RedisModule.forRoot()` here to prevent
      // multiple provider instances (which caused duplicate Redis connections).
      imports: [DatabaseModule.forFeature([UserEntity])],
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtAuthGuard,
        LoginRateLimitGuard,
        RolesGuard,
        {
          provide: "AUTH_STRATEGIES",
          useFactory: (redis: RedisService) => [new JwtAuthStrategy(redis)],
          inject: [RedisService],
        },
      ],
      exports: [AuthService],
    };
  }
}
