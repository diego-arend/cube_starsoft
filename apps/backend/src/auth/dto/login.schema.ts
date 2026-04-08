import { z } from "zod";

const sanitizeString = (val: unknown) => {
  if (typeof val !== "string") return val;
  return val.trim();
};

export const LoginSchema = z.object({
  email: z
    .preprocess(sanitizeString, z.string().email())
    .transform((s) => s.toLowerCase()),
  password: z.preprocess(sanitizeString, z.string().min(8)),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshSchema = z.object({
  refreshToken: z.preprocess(sanitizeString, z.string().min(10)),
});

export type RefreshDto = z.infer<typeof RefreshSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresIn: z.number(),
  role: z.string().optional(),
});
