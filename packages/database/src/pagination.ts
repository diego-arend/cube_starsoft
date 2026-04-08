import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  OffsetPaginationSchema,
  type OffsetPaginationDto,
  type PaginationMeta,
  type PaginatedResult,
} from "./shared-schemas";

export {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  OffsetPaginationSchema,
  type OffsetPaginationDto,
  type PaginationMeta,
  type PaginatedResult,
};

export type PaginationOptions = {
  page?: number;
  limit?: number;
  skip?: number;
  take?: number;
  order?: Record<string, "ASC" | "DESC"> | undefined;
  where?: unknown;
  q?: string;
  isKb?: boolean;
};
