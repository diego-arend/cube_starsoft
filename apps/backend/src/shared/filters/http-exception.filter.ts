import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from "@nestjs/common";

const STATUS_CODE_MAP: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: "BAD_REQUEST",
  [HttpStatus.UNAUTHORIZED]: "UNAUTHORIZED",
  [HttpStatus.NOT_FOUND]: "NOT_FOUND",
  [HttpStatus.CONFLICT]: "CONFLICT",
  [HttpStatus.INTERNAL_SERVER_ERROR]: "INTERNAL_SERVER_ERROR",
};

function statusToCode(status: number) {
  return STATUS_CODE_MAP[Number(status)] ?? "INTERNAL_SERVER_ERROR";
}

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor() {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let details: unknown = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
        details = {};
      } else if (typeof res === "object" && res !== null) {
        // Nest often sets { statusCode, message, error } or validation details
        const obj = res as any;
        if (typeof obj.message === "string") message = obj.message;
        else if (Array.isArray(obj.message)) message = obj.message.join(", ");
        else if (status === HttpStatus.BAD_REQUEST)
          message = "Validation failed";
        // If the response is the default Nest shape { statusCode, message, error }
        // and the `message` is a string, treat it like a simple string response and
        // do not expose internal fields as `details` (keep details empty).
        const candidate = obj?.details ?? obj;
        const looksLikeNestDefault =
          typeof obj?.statusCode === "number" && typeof obj?.error === "string";
        if (looksLikeNestDefault && typeof obj.message === "string") {
          details = {};
        } else if (
          status === HttpStatus.BAD_REQUEST &&
          containsZodErrors(candidate)
        ) {
          details = normalizeZodDetails(candidate);
        } else {
          details = candidate;
        }
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      details = {};
    }

    const code = statusToCode(status);

    function containsZodErrors(obj: unknown): boolean {
      if (!obj || typeof obj !== "object") return false;
      const o = obj as any;
      if (Array.isArray(o._errors) && o._errors.length > 0) return true;
      return Object.values(o as Record<string, unknown>).some((v: unknown) =>
        containsZodErrors(v)
      );
    }

    function normalizeZodDetails(obj: unknown): Record<string, string> {
      const out: Record<string, string> = {};
      function walk(val: any, path = "") {
        if (!val || typeof val !== "object") return;
        if (Array.isArray(val._errors) && val._errors.length > 0) {
          const msg = val._errors.filter(Boolean).join("; ");
          const key = path || "body";
          out[key] = msg;
        }
        for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
          if (k === "_errors") continue;
          const nextPath = path ? `${path}.${k}` : k;
          walk(v, nextPath);
        }
      }
      walk(obj);
      return out;
    }

    // Log server errors
    if (Number(status) >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(message, exception as any);
    }

    response.status(status).send({ message, code, details });
  }
}
