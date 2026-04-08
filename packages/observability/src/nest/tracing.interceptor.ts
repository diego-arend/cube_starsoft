import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { Observable, throwError } from "rxjs";
import { tap, catchError } from "rxjs/operators";

@Injectable()
export class TracingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const span = trace.getActiveSpan();

    // Tenta injetar o user.id no span atual para rastreabilidade
    if (span && request.user?.id) {
      span.setAttribute("user.id", request.user.id);
    }

    return next.handle().pipe(
      tap(() => {
        const span = trace.getActiveSpan();
        if (span) {
          const { traceId, spanId } = span.spanContext();
          const response = context.switchToHttp().getResponse();

          // Check if it's an HTTP response (Fastify/Express)
          if (response && typeof response.header === "function") {
            // Injeta os IDs no Header da resposta (compatível com servidor de observabilidade)
            response.header("trace_id", traceId);
            response.header("span_id", spanId);
          }
        }
      }),
      catchError((err) => {
        const span = trace.getActiveSpan();
        if (span) {
          span.recordException(err);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message,
          });
        }
        return throwError(() => err);
      })
    );
  }
}
