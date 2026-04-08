import NextAuth from "next-auth";
import { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { apiFetch } from "./lib/api-fetch";
import { logger } from "./lib/logger";
import { env, type Env } from "@turborepo/config";

const typedEnv = env as Env;
const apiUrl = typedEnv.API_URL || env.NEXT_PUBLIC_API_URL;
const authSecret = env.FRONTEND_AUTH_SECRET;

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await apiFetch(`${apiUrl}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refreshToken: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      logger.error({
        msg: "Refresh token API error",
        error: refreshedTokens,
      });
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.accessToken,
      expiresAt: Date.now() + refreshedTokens.expiresIn * 1000,
      refreshToken: refreshedTokens.refreshToken ?? token.refreshToken,
    };
  } catch (error) {
    logger.error({
      msg: "Error refreshing access token",
      error: String(error),
    });
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const { handlers, auth } = NextAuth({
  // Only enable verbose NextAuth debug when explicitly requested via env
  debug: process.env.NEXTAUTH_DEBUG === "true",
  // Route NextAuth logs into our application's logger so we can control levels/format
  logger: {
    error(error) {
      try {
        logger.error({ msg: "[auth][error]", error });
      } catch {
        // fallback to console if logger fails
        console.error("[auth][error]", error);
      }
    },
    warn(code) {
      try {
        logger.warn({ msg: `[auth][warn] ${code}` });
      } catch {
        console.warn(`[auth][warn] ${code}`);
      }
    },
    debug(code) {
      if (process.env.NEXTAUTH_DEBUG === "true") {
        try {
          logger.debug({ msg: `[auth][debug] ${code}` });
        } catch {
          console.debug(`[auth][debug] ${code}`);
        }
      }
    },
  },
  secret: authSecret,
  events: {
    async signOut(message) {
      // In Auth.js v5, the token is available in the message object
      const token = (
        message as { token?: { accessToken?: string; id?: string } }
      ).token;

      if (token?.accessToken) {
        try {
          await apiFetch(`${apiUrl}/auth/logout`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token.accessToken}`,
            },
          });
          logger.info({
            msg: "Backend session invalidated successfully",
            userId: token.id,
          });
        } catch (error) {
          logger.error({
            msg: "Failed to invalidate backend session on logout",
            error: String(error),
          });
        }
      }
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;

          /**
           * CONTEXTO DE PRODUÇÃO (DOCKER / CLOUD):
           * No servidor (SSR), 'localhost:8081' não é acessível dentro do container.
           * 1. Priorizamos 'API_URL' (Runtime Env) para permitir comunicação direta via rede interna (ex: http://backend:3001).
           * 2. Se a URL ainda for 'localhost' em produção, aplicamos um "auto-patch" para o nome do serviço no Docker.
           * 3. Isso evita latência de rede externa e resolve erros de 'ECONNREFUSED' em orquestradores (Compose/Swarm).
           */
          const fetchUrl = (process.env.API_URL ||
            typedEnv.API_URL ||
            env.NEXT_PUBLIC_API_URL ||
            "http://backend:3001") as string;

          const isLocalhost =
            fetchUrl.includes("localhost") || fetchUrl.includes("127.0.0.1");
          const finalUrl =
            isLocalhost && process.env.NODE_ENV === "production"
              ? "http://backend:3001"
              : fetchUrl;

          try {
            // Removemos o '/api' se usarmos a porta 3001 diretamente, pois o stripPrefix do Traefik
            // só ocorre quando passa pelo proxy. O back-end ouve na raiz ou em rotas sem prefixo /api.
            const endpoint = finalUrl.endsWith("/api")
              ? `${finalUrl}/auth/login`
              : `${finalUrl}/auth/login`;

            const res = await apiFetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            });

            if (!res.ok) {
              return null;
            }

            const data = await res.json();

            if (data && data.accessToken) {
              // Decode JWT to get user info
              const payload = JSON.parse(atob(data.accessToken.split(".")[1]));

              return {
                id: payload.sub,
                email: payload.email,
                role: payload.role,
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                expiresAt: Date.now() + data.expiresIn * 1000,
              };
            }

            return null;
          } catch (error) {
            console.error("Erro na autenticação:", error);
            return null;
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          accessToken: user.accessToken,
          refreshToken: user.refreshToken,
          expiresAt: user.expiresAt,
          role: user.role,
          id: user.id,
        };
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < token.expiresAt) {
        return token;
      }

      // Access token has expired, try to update it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (token) {
        session.accessToken = token.accessToken;
        session.refreshToken = token.refreshToken;
        session.error = token.error;
        if (session.user) {
          session.user.role = token.role;
          session.user.id = token.id;
        }
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isPublicPage =
        nextUrl.pathname === "/" || nextUrl.pathname.startsWith("/login");

      if (isPublicPage) {
        return true;
      }

      return isLoggedIn;
    },
  },
  pages: {
    signIn: "/login",
  },
});
