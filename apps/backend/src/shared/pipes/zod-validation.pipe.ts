import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from "@nestjs/common";
import { ZodTypeAny, ZodError } from "zod";

@Injectable()
export class ZodValidationPipe<T extends ZodTypeAny> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    void _metadata;
    try {
      const res = (this.schema as any).safeParse(value);
      if (!res.success) {
        throw new BadRequestException(res.error.format());
      }
      return res.data as unknown as ReturnType<T["parse"]>;
    } catch (err) {
      if (err instanceof ZodError) {
        throw new BadRequestException(err.format());
      }
      throw err;
    }
  }
}
