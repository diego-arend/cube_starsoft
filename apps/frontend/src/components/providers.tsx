"use client";

import * as React from "react";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { Session } from "next-auth";
import { LoadingProvider } from "./loading-provider";
import { SessionAuthListener } from "./session-auth-listener";
import { OtelProvider } from "./otel-provider";

export function Providers({
  children,
  session,
  ...props
}: React.ComponentProps<typeof NextThemesProvider> & {
  session: Session | null;
}) {
  return (
    <SessionProvider session={session}>
      <OtelProvider />
      <SessionAuthListener />
      <NextThemesProvider {...props}>
        <LoadingProvider>{children}</LoadingProvider>
      </NextThemesProvider>
    </SessionProvider>
  );
}
