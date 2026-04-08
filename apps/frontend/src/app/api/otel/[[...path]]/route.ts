import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> }
) {
  const isEnabled =
    process.env.OTEL_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_OTEL_ENABLED === "true";

  if (!isEnabled) {
    return new NextResponse(null, { status: 204 });
  }

  const otelEndpoint =
    process.env.FRONTEND_OTEL_EXPORTER_OTLP_ENDPOINT ||
    process.env.OTEL_EXPORTER_OTLP_HTTP_ENDPOINT ||
    "http://traefik:4318";

  // Reconstruct the full OTLP path (e.g., v1/metrics, v1/traces)
  const resolvedParams = await params;
  let subPath = resolvedParams.path?.join("/") || "";

  // Fallback for direct calls to /api/otel
  if (!subPath || subPath === "otel") {
    subPath = "v1/traces";
  }

  const url = `${otelEndpoint.replace(/\/$/, "")}/${subPath}`;

  // Log incoming request for debugging
  console.log(`[OTEL Proxy] POST ${req.nextUrl.pathname} -> ${url}`);

  const headers = new Headers();

  // Forward relevant headers
  const contentType = req.headers.get("Content-Type");
  if (contentType) headers.set("Content-Type", contentType);

  const userAgent = req.headers.get("User-Agent");
  if (userAgent) headers.set("User-Agent", userAgent);

  // Add configured OTLP headers if available
  const configHeaders = process.env.OTEL_EXPORTER_OTLP_HEADERS;
  if (configHeaders) {
    configHeaders.split(",").forEach((header) => {
      const [key, value] = header.split("=");
      if (key && value) {
        headers.set(key.trim(), value.trim());
      }
    });
  }

  try {
    const body = await req.arrayBuffer();

    const response = await fetch(url, {
      method: "POST",
      headers,
      body,
      duplex: "half",
    } as RequestInit);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "No error body");
      console.error(
        `[OTEL Proxy] Upstream error from ${url}: ${response.status} ${response.statusText}`,
        errorText
      );
    }

    return new NextResponse(null, { status: response.status });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // If fetch failed (e.g. collector is offline), return 202 to avoid 500 errors
    // in the frontend logs during development, but keep a warning in the server console.
    if (
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("ECONNREFUSED")
    ) {
      console.warn(
        `[OTEL Proxy] Collector at ${url} is unreachable. Metrics/Traces dropped. (fetch failed)`
      );
      return new NextResponse(null, { status: 202 });
    }

    console.error(`[OTEL Proxy] Failed to proxy to ${url}:`, errorMessage);
    return new NextResponse(null, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, x-otlp-api-key",
    },
  });
}

export async function GET() {
  return new NextResponse(JSON.stringify({ status: "OTEL Proxy is running" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
