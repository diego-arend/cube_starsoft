import {
  trace,
  context,
  propagation,
  isSpanContextValid,
} from "@opentelemetry/api";
import { logger } from "./logger";

// Lazy import to avoid breaking browser bundle or edge runtime
let _nextHeaders: (() => Promise<{ get(name: string): string | null }>) | null =
  null;
if (typeof window === "undefined") {
  // Only attempt import on server — next/headers throws if called outside request context
  import("next/headers")
    .then((m) => {
      _nextHeaders = m.headers;
    })
    .catch(() => {
      // not available in all Next.js versions or runtimes
    });
}

/**
 * Isomorphic fetch wrapper for the frontend.
 * Supports both client and server environments.
 */

type FetchHooks = {
  onStart?: () => void;
  onEnd?: () => void;
};

let hooks: FetchHooks = {};

/**
 * Register hooks to be called on every fetch.
 * Usually called by a client-side hook or provider.
 */
export function setApiFetchHooks(newHooks: FetchHooks) {
  hooks = { ...hooks, ...newHooks };
}

export async function apiFetch(
  input: string | URL | Request,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method ?? "GET";
  const url = input.toString();

  // Call onStart hook if registered (usually client-side)
  hooks.onStart?.();

  const headers = new Headers(init?.headers);

  // Get current active span context for correlation
  const activeSpan = trace.getSpan(context.active());
  const spanContext = activeSpan?.spanContext();
  const isValid = spanContext ? isSpanContextValid(spanContext) : false;

  const traceId = isValid ? spanContext?.traceId : undefined;
  const spanId = isValid ? spanContext?.spanId : undefined;

  // Inject OpenTelemetry context if available into the headers.
  // UndiciInstrumentation (via getNodeAutoInstrumentations) handles this automatically
  // at the dispatcher level for server-side fetch. The manual injection below is a
  // safety net for contexts where the active span exists but auto-injection isn't active.
  try {
    propagation.inject(context.active(), headers, {
      set: (h, k, v) => h.set(k, typeof v === "string" ? v : String(v)),
    });
  } catch {
    // Ignore propagation errors
  }

  // Ensure we always have trace_id/span_id for logging and legacy backend support
  if (traceId) {
    if (!headers.has("trace_id")) headers.set("trace_id", traceId);
    if (!headers.has("x-trace-id")) headers.set("x-trace-id", traceId);
  }
  if (spanId && !headers.has("span_id")) {
    headers.set("span_id", spanId);
  }

  // Fallback 1: Manually set traceparent from active span if propagation.inject didn't do it
  if (!headers.has("traceparent") && traceId && spanId) {
    headers.set("traceparent", `00-${traceId}-${spanId}-01`);
  }

  // Fallback 2: App Router / React Server Components — inherit traceparent from the
  // incoming Next.js request when context.active() has no active span.
  // This covers the case where AsyncLocalStorage propagation breaks across RSC boundaries.
  if (!headers.has("traceparent") && _nextHeaders) {
    try {
      const incomingHeaders = await _nextHeaders();
      const incomingTraceparent = incomingHeaders.get("traceparent");
      if (incomingTraceparent) {
        headers.set("traceparent", incomingTraceparent);
      }
    } catch {
      // Not in a Next.js request context (e.g.: during static generation), ignore
    }
  }

  const config = {
    ...init,
    headers,
  };

  const start = Date.now();

  try {
    const response = await fetch(input, config);
    const duration = Date.now() - start;

    logger.info({
      msg: `Outbound request: ${method} ${url} - ${response.status}`,
      method,
      url,
      status: response.status,
      duration: `${duration}ms`,
      trace_id: traceId,
      span_id: spanId,
    });

    return response;
  } catch (error) {
    const duration = Date.now() - start;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error({
      msg: `Outbound request failed: ${method} ${url} - ${errorMessage}`,
      method,
      url,
      error: errorMessage,
      duration: `${duration}ms`,
      trace_id: traceId,
      span_id: spanId,
    });

    throw error;
  } finally {
    hooks.onEnd?.();
  }
}
