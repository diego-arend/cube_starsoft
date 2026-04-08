import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { UserRepository } from "@turborepo/database";
import bcrypt from "bcryptjs";
import { Inject } from "@nestjs/common";
import { AuthStrategy } from "./strategies/auth.strategy";
import { UserPublicSchema, type UserPublicDto } from "@turborepo/database";
import { RedisService } from "@turborepo/redis";
import { typedEnv } from "../env";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly strategies: Map<string, AuthStrategy> = new Map();
  private readonly cfg = typedEnv;

  constructor(
    private readonly userRepo: UserRepository,
    private readonly redisService: RedisService,
    @Inject("AUTH_STRATEGIES") strategies: AuthStrategy[]
  ) {
    // register injected strategies
    for (const s of strategies ?? []) {
      this.strategies.set(s.name, s);
    }
  }

  async registerUser(
    email: string,
    password: string,
    role?: string
  ): Promise<UserPublicDto> {
    // sanitize & hash
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.userRepo.save({
      email,
      passwordHash: hashed,
      role: role ?? undefined,
    } as Partial<import("@turborepo/database").UserEntity>);
    // Sanitize the saved entity using the public DTO schema
    return UserPublicSchema.parse(user);
  }

  private pickStrategy(name?: string) {
    const strategyName = name ?? "jwt";
    const strat = this.strategies.get(strategyName);
    if (!strat) throw new Error(`Auth strategy ${strategyName} not found`);
    return strat;
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findByEmail(email);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    if (!user.passwordHash)
      throw new UnauthorizedException("User has no password set");
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) throw new UnauthorizedException("Invalid credentials");
    // delegate to strategy
    const strat = this.pickStrategy("jwt");
    return await strat.login({
      id: user.id,
      email: user.email,
      role: user.role ?? undefined,
    });
  }

  async refreshToken(refreshToken: string) {
    const strat = this.pickStrategy("jwt");
    return await strat.refresh(refreshToken);
  }

  // validateAccessToken is handled by JwtAuthGuard and strategy; remove placeholder

  async logout(userId: string, jti: string) {
    try {
      // remove access token
      await this.redisService.del(`auth:access:${jti}`);
      try {
        await this.redisService.sRem(`auth:access:user:${userId}`, jti);
      } catch {
        // ignore
      }

      // Attempt to find an associated refresh JTI for this access JTI and
      // revoke it as well so logout fully terminates the session.
      try {
        const refreshJti = await this.redisService.get(`auth:session:${jti}`);
        if (refreshJti) {
          try {
            await this.redisService.del(`auth:refresh:${refreshJti}`);
          } catch {
            // ignore
          }
          try {
            await this.redisService.sRem(
              `auth:refresh:user:${userId}`,
              refreshJti
            );
          } catch {
            // ignore
          }
          try {
            await this.redisService.del(`auth:session:${jti}`);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore lookup errors
      }

      return { success: true };
    } catch (err) {
      this.logger.warn("Failed to logout token", err as Error);
      return { success: false };
    }
  }
}
