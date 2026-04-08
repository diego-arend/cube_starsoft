import { z } from "zod";

export const MultimodalConfigSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
  modelName: z.string().min(1),
  baseUrl: z.string().url().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxCompletionTokens: z.number().int().positive().optional(),
  reasoningEffort: z.enum(["low", "medium", "high"]).optional(),
});

export type MultimodalConfig = z.infer<typeof MultimodalConfigSchema>;
