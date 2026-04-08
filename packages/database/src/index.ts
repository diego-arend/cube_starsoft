export * from "./modules/database.module";
export * from "./entities/user.entity";
export * from "./entities/document.entity";
export * from "./entities/document-embedding.entity";
export * from "./entities/assistant-conversation.entity";
export * from "./entities/assistant-message.entity";
export * from "./entities/agent.entity";
export * from "./dto/document.dto";
export * from "./pagination";
export * from "./repositories/base.repository";
export * from "./repositories/user.repository";
export * from "./repositories/assistant-conversation.repository";
export * from "./repositories/assistant-message.repository";
export * from "./interfaces/user.interface";
export * from "./dto/user.dto";
export * from "./dto/agent.dto";
export * from "./enums/user-role.enum";
export * from "./database.lifecycle.service";
export * from "./decorators/transactional.decorator";

// Export the AppDataSource so tests and tooling can inspect runtime options. This
// is an internal utility; consuming code should prefer Nest's DI or the
// database module instead of manipulating the DataSource directly.
export { AppDataSource } from "./data-source";

// Explicitly export repository classes to ensure they are included in the
// compiled declaration files (some bundlers/tree-shakers may omit star
// re-exports if not referenced). Named exports make the API contract
// explicit for TypeScript consumers and editor tooling.
export { UserRepository } from "./repositories/user.repository";
export type { IUserRepository } from "./repositories/user.repository";
export { USER_REPOSITORY } from "./repositories/user.repository";
export {
  AssistantConversationRepository,
  ASSISTANT_CONVERSATION_REPOSITORY,
} from "./repositories/assistant-conversation.repository";
export type { IAssistantConversationRepository } from "./repositories/assistant-conversation.repository";
export {
  AssistantMessageRepository,
  ASSISTANT_MESSAGE_REPOSITORY,
} from "./repositories/assistant-message.repository";
export type { IAssistantMessageRepository } from "./repositories/assistant-message.repository";
export {
  AgentRepository,
  AGENT_REPOSITORY,
} from "./repositories/agent.repository";
export type { IAgentRepository } from "./repositories/agent.repository";
export type { IDocumentRepository } from "./repositories/document.repository";
export { DOCUMENT_REPOSITORY } from "./repositories/document.repository";
export { DocumentRepository } from "./repositories/document.repository";
export {
  DocumentEmbeddingRepository,
  DOCUMENT_EMBEDDING_REPOSITORY,
} from "./repositories/document-embedding.repository";
export type { IDocumentEmbeddingRepository } from "./repositories/document-embedding.repository";

// Re-export TypeORM utilities so consumers of @turborepo/database don't need to
// add @nestjs/typeorm or typeorm as direct dependencies.
export { getRepositoryToken } from "@nestjs/typeorm";
export type { Repository } from "typeorm";
