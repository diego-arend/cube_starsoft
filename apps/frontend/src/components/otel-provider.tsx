"use client";

import { useEffect } from "react";

/**
 * Initializes Grafana Faro SDK for browser observability.
 *
 * Faro automatically captures (no extra code needed):
 * - Unhandled JS errors with full stack traces
 * - console.error / console.warn
 * - Web Vitals: LCP, INP, CLS, FCP, TTFB
 * - SPA navigation events
 * - Distributed traces browser → server → backend (via traceparent header)
 */
export function OtelProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!process.env.NEXT_PUBLIC_FARO_URL) return;

    // Synchronous guard stored on window so it survives HMR module reloads.
    // Prevents the race condition in React StrictMode / Turbopack dev where
    // two concurrent async invocations both see faro as uninitialised and the
    // second one triggers Faro's internal console.error before we can catch it.
    const win = window as Window & { __faroInitialized?: boolean };
    if (win.__faroInitialized) return;
    win.__faroInitialized = true;

    void (async () => {
      const { initializeFaro, getWebInstrumentations, faro } =
        await import("@grafana/faro-web-sdk");

      // Secondary guard for the faro object itself (belt-and-suspenders)
      if (faro?.api && Object.keys(faro.api).length > 0) return;

      const { TracingInstrumentation } =
        await import("@grafana/faro-web-tracing");

      try {
        initializeFaro({
          url: process.env.NEXT_PUBLIC_FARO_URL!,
          app: {
            name: process.env.NEXT_PUBLIC_OTEL_SERVICE_NAME ?? "frontend",
            version: process.env.NEXT_PUBLIC_APP_VERSION ?? "1.0.0",
            environment: process.env.NEXT_PUBLIC_ENV ?? "production",
          },
          instrumentations: [
            ...getWebInstrumentations({ captureConsole: true }),
            new TracingInstrumentation(),
          ],
        });
      } catch (error) {
        // Silently fail if Faro is already registered (common in React StrictMode/HMR)
        if (
          error instanceof Error &&
          error.message.includes("Faro is already registered")
        ) {
          return;
        }
        throw error;
      }
    })();
  }, []);

  return null;
}
