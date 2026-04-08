import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { RedisService } from "@turborepo/redis";
import { typedEnv } from "../../env";
import { observeLoginAttempt } from "@turborepo/rate-limit";

@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  private readonly cfg = typedEnv;
  private readonly maxPerEmail: number;
  private readonly windowMs: number;

  constructor(private readonly redis: RedisService) {
    this.maxPerEmail = Number(this.cfg.AUTH_LOGIN_RATE_LIMIT_MAX ?? 5);
    this.windowMs = Number(this.cfg.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS ?? 60_000);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const ip = req.ip || req.raw?.socket?.remoteAddress || "unknown";
    const ipStr = String(ip);
    const body = req.body as { email?: string } | undefined;
    const emailStr = body?.email;
    const store = this.redis.getRateLimitStore(this.windowMs, "in-memory");
    // per-ip is handled by global rate-limiter plugin; enforce per-email
    // also apply a stricter per-ip restriction for login attempts
    try {
      const { ipCount, emailCount } = await observeLoginAttempt(
        store,
        ipStr,
        emailStr,
        this.cfg
      );

      if (ipCount && ipCount > Number(this.cfg.RATE_LIMIT_MAX_REQUESTS ?? 20)) {
        throw new HttpException(
          "Too many requests from this IP",
          HttpStatus.TOO_MANY_REQUESTS
        );
      }

      if (emailCount && emailCount > this.maxPerEmail) {
        throw new HttpException(
          "Too many login attempts for this account",
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    } catch (err) {
      // If store is in passthrough mode, incr may throw or no-op; be conservative and let through
      if (err instanceof HttpException) {
        const status = err.getStatus?.();
        if (Number(status) === Number(HttpStatus.TOO_MANY_REQUESTS)) throw err;
      }
    }
    return true;
  }
}
