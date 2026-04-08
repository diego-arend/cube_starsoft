import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      role: string;
      address: string;
    } & DefaultSession["user"];
    error?: "RefreshAccessTokenError";
  }

  interface User {
    id: string;
    role: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    role: string;
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    error?: "RefreshAccessTokenError";
    id: string;
  }
}
