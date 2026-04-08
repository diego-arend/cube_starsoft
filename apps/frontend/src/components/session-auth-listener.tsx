"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

export function SessionAuthListener() {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.error === "RefreshAccessTokenError") {
      void signOut({ callbackUrl: "/login" });
    }
  }, [session]);

  return null;
}
