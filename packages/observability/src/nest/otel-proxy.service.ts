import { Injectable, Logger, Inject } from "@nestjs/common";
import type { Env } from "@turborepo/config";

import type { FastifyRequest } from "fastify";

@Injectable()
export class OtelProxyService {
  private readonly logger = new Logger(OtelProxyService.name);

  constructor(@Inject("OBSERVABILITY_CONFIG") private readonly env: Env) {}

  private getTargetUrl(resource: string): string {
    const base =
      this.env.OTEL_EXPORTER_OTLP_HTTP_ENDPOINT ?? "http://localhost:3201";

    // Fallback to construction logic if per-kind envs aren't specifically set
    const url = `${base.replace(/\/$/, "")}/v1/${resource}`;
    return url;
  }

  async proxy(resource: string, req: FastifyRequest) {
    const target = this.getTargetUrl(resource);
    this.logger.debug(`Proxying OTEL ${resource} -> ${target}`);

    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers ?? {})) {
      if (!v) continue;
      if (k.toLowerCase() === "host") continue;
      // Filter out authorization header before forwarding to collector
      if (k.toLowerCase() === "authorization") continue;
      headers[k] = Array.isArray(v) ? v.join(",") : String(v);
    }

    const resp = await fetch(target, {
      method: "POST",
      headers,
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    return resp;
  }
}
