import { Injectable, UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { typedEnv } from "../../env";
import type { AuthStrategy, AuthStrategyResult } from "./auth.strategy";
import type { RedisService } from "@turborepo/redis";

export type JwtPayload = {
  sub: string;
  email: string;
  jti: string;
  role?: string;
};

@Injectable()
export class JwtAuthStrategy implements AuthStrategy<{
  id: string;
  email: string;
  role?: string;
}> {
  name = "jwt";
  private readonly cfg = typedEnv;
  private readonly jwtSecret: string | undefined;
  private readonly jwtExpiresIn: string | number;
  private readonly refreshJwtSecret: string | undefined;
  private readonly refreshExpiresIn: string | number;
  private readonly jwtIssuer: string | undefined;
  private readonly jwtAudience: string | undefined;

  constructor(private readonly redisService: RedisService) {
    this.jwtSecret = this.cfg.JWT_SECRET;
    this.jwtExpiresIn = this.cfg.JWT_EXPIRES_IN ?? 3600; // seconds
    this.refreshJwtSecret = this.cfg.JWT_REFRESH_SECRET;
    this.refreshExpiresIn = this.cfg.JWT_REFRESH_EXPIRES_IN ?? 60 * 60 * 24 * 7; // 7 days
    this.jwtIssuer = this.cfg.JWT_ISSUER ?? process.env.JWT_ISSUER;
    this.jwtAudience = this.cfg.JWT_AUDIENCE ?? process.env.JWT_AUDIENCE;
    // Enforce presence in production, but allow tests/dev to operate without a secret.
    if (!this.jwtSecret) {
      void 0;
    }
  }

  async login(payload: { id: string; email: string; role?: string }) {
    if (!this.jwtSecret) throw new Error("JWT_SECRET not configured");
    const jti = uuidv4();
    const accessTtl = Number(this.jwtExpiresIn);
    if (!Number.isFinite(accessTtl) || accessTtl <= 0) {
      throw new Error(
        "Invalid configuration: JWT_EXPIRES_IN must be a positive number"
      );
    }
    const signOptions: jwt.SignOptions = {
      // ensure the type matches sign() overload -- use numeric seconds
      expiresIn: accessTtl as any,
      algorithm: "HS256",
    };
    if (typeof this.jwtIssuer === "string") signOptions.issuer = this.jwtIssuer;
    if (typeof this.jwtAudience === "string")
      signOptions.audience = this.jwtAudience;

    const accessToken = jwt.sign(
      { sub: payload.id, email: payload.email, jti, role: payload.role },
      this.jwtSecret as jwt.Secret,
      signOptions
    );
    // store jti in redis with TTL (in seconds)
    const redis = this.redisService;
    try {
      const accessTtl = Number(this.jwtExpiresIn);
      if (!Number.isFinite(accessTtl) || accessTtl <= 0) {
        throw new Error(
          "Invalid configuration: JWT_EXPIRES_IN must be a positive number"
        );
      }
      await redis.set(`auth:access:${jti}`, payload.id, accessTtl);
      // Add access jti to per-user set for session-wide revocation
      try {
        await redis.sAdd(`auth:access:user:${payload.id}`, jti);
        // set TTL on the per-user set to avoid orphaned entries
        try {
          await redis.expire(`auth:access:user:${payload.id}`, accessTtl);
        } catch {
          // ignore expire failures
        }
      } catch {
        void 0;
      }
    } catch {
      // ignore cache errors — fallback handled by redis service
    }
    // create refresh token if secret is configured
    let refreshToken;
    if (this.refreshJwtSecret) {
      const refreshJti = uuidv4();
      const refreshTtl = Number(this.refreshExpiresIn);
      if (!Number.isFinite(refreshTtl) || refreshTtl <= 0) {
        throw new Error(
          "Invalid configuration: JWT_REFRESH_EXPIRES_IN must be a positive number"
        );
      }
      const refreshSignOptions: jwt.SignOptions = {
        expiresIn: refreshTtl as any,
        algorithm: "HS256",
      };
      if (typeof this.jwtIssuer === "string")
        refreshSignOptions.issuer = this.jwtIssuer;
      if (typeof this.jwtAudience === "string")
        refreshSignOptions.audience = this.jwtAudience;

      refreshToken = jwt.sign(
        {
          sub: payload.id,
          email: payload.email,
          jti: refreshJti,
          role: payload.role,
        },
        this.refreshJwtSecret as jwt.Secret,
        refreshSignOptions
      );
      try {
        await redis.set(`auth:refresh:${refreshJti}`, payload.id, refreshTtl);
        // Add refresh jti to per-user set for session-wide revocation
        try {
          await redis.sAdd(`auth:refresh:user:${payload.id}`, refreshJti);
          try {
            await redis.expire(`auth:refresh:user:${payload.id}`, refreshTtl);
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
        // Create a session mapping from access jti -> refresh jti so logout
        // using only the access token can also revoke the refresh token.
        try {
          await redis.set(`auth:session:${jti}`, refreshJti, refreshTtl);
        } catch {
          // ignore
        }
      } catch {
        // ignore
      }
    }
    return {
      accessToken,
      refreshToken,
      expiresIn: Number(this.jwtExpiresIn),
      role: payload.role,
    } as AuthStrategyResult;
  }

  async refresh(refreshToken: string) {
    if (!this.refreshJwtSecret || !this.jwtSecret)
      throw new Error("JWT_REFRESH_SECRET or JWT_SECRET missing");
    const verifyOptions: jwt.VerifyOptions = { algorithms: ["HS256"] };
    if (typeof this.jwtIssuer === "string")
      verifyOptions.issuer = this.jwtIssuer;
    if (typeof this.jwtAudience === "string")
      verifyOptions.audience = this.jwtAudience;

    const decoded = jwt.verify(
      refreshToken,
      this.refreshJwtSecret,
      verifyOptions
    ) as JwtPayload;
    // check redis refresh jti presence
    const redis = this.redisService;
    const storedUserId = await redis.get(`auth:refresh:${decoded.jti}`);
    if (!storedUserId || storedUserId !== decoded.sub)
      throw new UnauthorizedException("invalid refresh token");
    // create new tokens
    const res = await this.login({
      id: decoded.sub,
      email: decoded.email,
      role: decoded.role,
    });
    // invalidate old refresh token
    try {
      await redis.del(`auth:refresh:${decoded.jti}`);
      // remove from per-user set if present
      try {
        await redis.sRem(`auth:refresh:user:${decoded.sub}`, decoded.jti);
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
    return res;
  }
}
