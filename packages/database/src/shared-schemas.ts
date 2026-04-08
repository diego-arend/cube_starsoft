import { z } from "zod";

/**
 * Common pagination constants
 */
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/**
 * Schema for offset-based pagination request parameters.
 * Shared between Frontend (for request building) and Backend (for validation).
 */
export const OffsetPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  sort: z.string().optional(),
  order: z.enum(["ASC", "DESC"]).optional(),
  q: z.string().optional(),
  isKb: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === "boolean") return val;
      if (val === "true") return true;
      if (val === "false") return false;
      return undefined;
    })
    .optional(),
});

/**
 * Type inferred from the OffsetPaginationSchema
 */
export type OffsetPaginationDto = z.infer<typeof OffsetPaginationSchema>;

/**
 * Common pagination metadata structure
 */
export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  pages: number;
};

/**
 * Generic interface for a paginated result set
 */
export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMeta;
};
