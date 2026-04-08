import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { metrics, Histogram } from "@opentelemetry/api";
import type { Env } from "@turborepo/config";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private histogram: Histogram;

  constructor(@Inject("OBSERVABILITY_CONFIG") private readonly env: Env) {
    const serviceName = this.env.OTEL_SERVICE_NAME || "nest-app";
    const meter = metrics.getMeter(serviceName);

    this.histogram = meter.createHistogram("http_request_duration_seconds", {
      description: "HTTP request duration in seconds",
      unit: "s",
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    const now = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const statusCode = res.statusCode as number;
          this.recordMetric(statusCode, now, context);
        },
        error: (err) => {
          const statusCode = (err.status || err.statusCode || 500) as number;
          this.recordMetric(statusCode, now, context);
        },
      })
    );
  }

  private recordMetric(
    statusCode: number,
    startTime: number,
    context: ExecutionContext
  ) {
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const status = statusCode >= 200 && statusCode < 400 ? "success" : "error";
    const family = `${Math.floor(statusCode / 100)}xx`;

    const attributes = {
      status,
      statusCode: String(statusCode),
      family,
      method,
    };

    const durationSeconds = (Date.now() - startTime) / 1000;
    this.histogram.record(durationSeconds, attributes);
  }
}
