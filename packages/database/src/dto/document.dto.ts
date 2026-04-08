import { z } from "zod";

export const DocumentPublicSchema = z.object({
  id: z.string(),
  key: z.string(),
  ownerId: z.string(),
  originalFilename: z.string(),
  contentType: z.string(),
  size: z.number(),
  isKb: z.boolean(),
  agentId: z.string().uuid().nullable().optional(),
  agentName: z.string().nullable().optional(),
  ownerEmail: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.union([z.date(), z.string()]).transform((val) => {
    if (val instanceof Date) return val.toISOString();
    return val;
  }),
  scanStatus: z.string(),
});

export type DocumentPublicDto = z.infer<typeof DocumentPublicSchema>;

// Support both JSON/base64 uploads and multipart/form-data file uploads.
export const UploadSchema = z.union([
  z.object({
    filename: z.string().min(1),
    contentType: z.string().optional(),
    dataBase64: z.string().min(1),
    isKb: z.boolean().optional(),
    agentId: z.string().uuid().nullable().optional(),
  }),
  z.object({
    // when using multipart/form-data the `file` field will contain a
    // binary stream/object. We accept `any` here to allow the multipart
    // parser to attach the file to the request body for validation.
    file: z.any(),
    filename: z.string().optional(),
    contentType: z.string().optional(),
    isKb: z
      .union([z.boolean(), z.string()])
      .transform((val) => {
        if (typeof val === "boolean") return val;
        if (val === "true") return true;
        if (val === "false") return false;
        return undefined;
      })
      .optional(),
    agentId: z.string().uuid().nullable().optional(),
  }),
]);

export type UploadDto = z.infer<typeof UploadSchema>;
