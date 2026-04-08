import { z } from "zod";

export const AssistantQuerySchema = z.object({
  conversationId: z.string().uuid().optional(),
  sessionId: z.string().min(1),
  messageId: z.string().uuid(),
  query: z.string().min(1).max(2000),
  agentId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});
