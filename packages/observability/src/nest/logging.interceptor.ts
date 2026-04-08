import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }
    const req = context.switchToHttp().getRequest();
    const method = req.method;
    const url = req.url;
    const route = req.route?.path || url;
    const userAgent = req.headers["user-agent"];
    const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          const res = context.switchToHttp().getResponse();
          const statusCode = res.statusCode;
          const duration = Date.now() - now;

          this.logger.log({
            msg: "Request completed",
            "http.method": method,
            "http.url": url,
            "http.route": route,
            "http.status_code": statusCode,
            "http.user_agent": userAgent,
            "http.client_ip": clientIp,
            duration: `${duration}ms`,
            response: data,
          });
        },
        error: (err) => {
          const duration = Date.now() - now;
          this.logger.error({
            msg: "Request failed",
            "http.method": method,
            "http.url": url,
            "http.route": route,
            "http.status_code": err.status || 500,
            "http.user_agent": userAgent,
            "http.client_ip": clientIp,
            duration: `${duration}ms`,
            error: err.message,
          });
        },
      })
    );
  }
}
