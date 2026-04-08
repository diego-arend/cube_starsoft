import { z } from "zod";

export const EmbeddingsConfigSchema = z.object({
  provider: z.enum(["openai", "local"]).default("openai"),
  apiKey: z.string().optional(),
  model: z.string().min(1),
  baseUrl: z.string().url().optional(),
});

export type EmbeddingsConfig = z.infer<typeof EmbeddingsConfigSchema>;
