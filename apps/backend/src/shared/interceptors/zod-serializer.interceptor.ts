import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import type { ZodTypeAny } from "zod";

@Injectable()
export class ZodSerializerInterceptor<
  T extends ZodTypeAny,
> implements NestInterceptor {
  constructor(private readonly schema: T) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((data: unknown) => {
        // Array of items
        if (Array.isArray(data)) {
          return (data as unknown[]).map((d) => this.schema.parse(d));
        }
        // Paginated response shape { data: [...], meta: { ... } }
        if (
          data &&
          typeof data === "object" &&
          Array.isArray((data as any).data) &&
          (data as any).meta !== undefined
        ) {
          const pag = data as { data: unknown[]; meta: unknown };
          return {
            ...pag,
            data: pag.data.map((d) => this.schema.parse(d)),
          };
        }
        // Single object
        return this.schema.parse(data);
      })
    );
  }
}
