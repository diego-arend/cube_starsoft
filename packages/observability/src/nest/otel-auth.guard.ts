import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from "@nestjs/common";
import type { Env } from "@turborepo/config";

@Injectable()
export class OtelAuthGuard implements CanActivate {
  constructor(@Inject("OBSERVABILITY_CONFIG") private readonly env: Env) {}

  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const auth = (req.headers?.authorization ?? req.headers?.Authorization) as
      | string
      | undefined;
    const token = this.env.OTEL_INGESTION_BEARER_TOKEN;

    if (!token) {
      // Safe default: don't allow ingestion unless a token is configured
      throw new UnauthorizedException("OTEL ingestion token not configured");
    }
    if (!auth) throw new UnauthorizedException("Missing Authorization header");
    if (!auth.startsWith("Bearer "))
      throw new UnauthorizedException("Invalid auth scheme");
    if (auth.slice(7) !== token)
      throw new UnauthorizedException("Invalid token");
    return true;
  }
}
