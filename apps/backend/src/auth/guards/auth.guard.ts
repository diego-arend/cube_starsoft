import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import jwt from "jsonwebtoken";
import { typedEnv } from "../../env";
import { RedisService } from "@turborepo/redis";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly cfg = typedEnv;

  constructor(
    private readonly redisService: RedisService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes flagged as public to bypass global auth
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest();
    const header = req.headers?.authorization as string | undefined;
    if (!header || !header.startsWith("Bearer "))
      throw new UnauthorizedException();
    const token = header.replace("Bearer ", "");
    const secret = this.cfg.JWT_SECRET ?? process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedException("JWT not configured");
    try {
      const decoded = jwt.verify(token, secret as jwt.Secret, {
        issuer: this.cfg.JWT_ISSUER ?? process.env.JWT_ISSUER,
        audience: this.cfg.JWT_AUDIENCE ?? process.env.JWT_AUDIENCE,
      }) as {
        jti?: string;
        sub?: string;
        role?: string;
      };
      if (!decoded || !decoded.jti || !decoded.sub)
        throw new UnauthorizedException();
      const stored = await this.redisService.get(`auth:access:${decoded.jti}`);
      if (!stored || stored !== decoded.sub) throw new UnauthorizedException();
      // attach user id and jti on request for handlers
      req.user = { id: decoded.sub, jti: decoded.jti, role: decoded.role };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
