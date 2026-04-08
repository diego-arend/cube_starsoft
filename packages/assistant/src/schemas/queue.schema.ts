import { z } from "zod";

// Mensagem publicada pelo Gateway → fila assistant.query
export const AssistantQueryMessageSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  messageId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  query: z.string().min(1).max(2000),
  agentId: z.string().uuid().optional(),
});

export type AssistantQueryMessage = z.infer<typeof AssistantQueryMessageSchema>;

// Mensagem publicada pelo Worker → fila assistant.response
export const AssistantResponseChunkSchema = z.object({
  sessionId: z.string().min(1),
  messageId: z.string().uuid(),
  chunk: z.string(),
  done: z.boolean(),
  error: z.string().optional(),
});

export type AssistantResponseChunk = z.infer<
  typeof AssistantResponseChunkSchema
>;
