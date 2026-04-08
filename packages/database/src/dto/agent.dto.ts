import { z } from "zod";

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  specialty: z.string().min(1),
  description: z.string().max(500).optional().nullable(),
  guardRails: z.string().min(1),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CreateAgentSchema = AgentSchema.pick({
  name: true,
  specialty: true,
  description: true,
  guardRails: true,
}).extend({
  isActive: z.boolean().optional().default(true),
});

export const UpdateAgentSchema = CreateAgentSchema.partial();

export type AgentDto = z.infer<typeof AgentSchema>;
export type CreateAgentDto = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentDto = z.infer<typeof UpdateAgentSchema>;
