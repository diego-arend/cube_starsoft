import { Module, Global, DynamicModule, Provider } from "@nestjs/common";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import type { Repository } from "typeorm";
import { UserEntity } from "../entities/user.entity";
import { DocumentEntity } from "../entities/document.entity";
import { DocumentEmbeddingEntity } from "../entities/document-embedding.entity";
import { AssistantConversationEntity } from "../entities/assistant-conversation.entity";
import { AssistantMessageEntity } from "../entities/assistant-message.entity";
import { AgentEntity } from "../entities/agent.entity";
import type { TypeOrmModuleOptions } from "@nestjs/typeorm";
import type { Env } from "@turborepo/config";
import { DatabaseLifecycleService } from "../database.lifecycle.service";
import {
  UserRepository,
  USER_REPOSITORY,
} from "../repositories/user.repository";
import {
  DocumentRepository,
  DOCUMENT_REPOSITORY,
} from "../repositories/document.repository";
import {
  DocumentEmbeddingRepository,
  DOCUMENT_EMBEDDING_REPOSITORY,
} from "../repositories/document-embedding.repository";
import {
  AssistantConversationRepository,
  ASSISTANT_CONVERSATION_REPOSITORY,
} from "../repositories/assistant-conversation.repository";
import {
  AssistantMessageRepository,
  ASSISTANT_MESSAGE_REPOSITORY,
} from "../repositories/assistant-message.repository";
import {
  AgentRepository,
  AGENT_REPOSITORY,
} from "../repositories/agent.repository";

// DatabaseModuleOptions removed — configuration is centralized and not exported from this package.

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(cfg: Env): DynamicModule {
    // For safety, **do not** run migrations or synchronize schema automatically
    // from the application startup. Schema changes should be managed explicitly
    // via CI/CD migration commands. We keep the env keys available for tools
    // but the runtime will not run them automatically.
    const synchronize = false;
    const migrationsRun = false;

    const config: TypeOrmModuleOptions = {
      type: "postgres",
      host: cfg.DATABASE_HOST ?? "localhost",
      port: cfg.DATABASE_PORT ?? 5432,
      username: cfg.DATABASE_USER ?? "postgres",
      password: cfg.DATABASE_PASSWORD ?? "password",
      database: cfg.DATABASE_NAME ?? "turborepo_saas",
      // Use explicit entity classes rather than globbed paths. Using `UserEntity`
      // directly avoids problems with glob resolution during `nest start --watch`
      // and when running from source in a monorepo. Include additional entities
      // used by the application (e.g., `DocumentEntity`) so TypeORM metadata is
      // available across feature modules that use them.
      entities: [
        UserEntity,
        DocumentEntity,
        DocumentEmbeddingEntity,
        AssistantConversationEntity,
        AssistantMessageEntity,
        AgentEntity,
      ],
      // Ensure synchronize is explicitly controlled; default to false to
      // avoid accidental schema changes on app startup. Use the env variable
      // if you intentionally want to run synchronize for testing/dev.
      synchronize,
      // Run migrations automatically on startup only if explicitly enabled.
      // Migrations are expected to be managed by CI/CD; don't enable this in
      // production unless you understand the implications.
      migrationsRun,
      logging: cfg.NODE_ENV === "development",
      // Prevent TypeORM from auto-installing database extensions at runtime.
      // This operation modifies the database (CREATE EXTENSION) and should be
      // managed explicitly via migrations/DB provisioning with appropriate
      // privileges (CI/CD or ops). See DatabaseLifecycleService logs for
      // the effective runtime policy.
      installExtensions: false,
      // options are intentionally not supported — configuration comes from typedEnv only
    };

    return {
      module: DatabaseModule,
      imports: [TypeOrmModule.forRoot(config)],
      providers: [
        {
          provide: DatabaseLifecycleService,
          useFactory: () => new DatabaseLifecycleService(cfg),
        },
      ],
      exports: [TypeOrmModule],
    };
  }

  // NOTE: Configuration is centralized inside this module and comes from `@turborepo/config`.
  // If you need a custom async factory, consider adding an internal helper, but do not expose configuration.

  static forFeature(entities: any[]): DynamicModule {
    const providers: Provider[] = [];
    // register UserRepository provider when UserEntity is included
    const userEntityClass = entities.find((e) => e?.name === "UserEntity");
    if (userEntityClass) {
      // Provide a repository instance under the abstract token for test/mocking
      // (`USER_REPOSITORY`) and also register the concrete `UserRepository` so
      // existing modules that inject the class directly continue to work.
      providers.push({
        provide: USER_REPOSITORY,
        useFactory: (repo: Repository<UserEntity>): UserRepository =>
          new UserRepository(repo),
        inject: [
          getRepositoryToken(
            userEntityClass as new (...args: unknown[]) => unknown
          ),
        ],
      });

      // Export a reference-compatible provider so consumers that depend on the
      // concrete `UserRepository` can still be resolved. This uses `useExisting`
      // to point to the `USER_REPOSITORY` instance (no double instantiation).
      providers.push({
        provide: UserRepository,
        useExisting: USER_REPOSITORY as unknown as symbol,
      });
    }

    const documentEntityClass = entities.find(
      (e) => e?.name === "DocumentEntity"
    );
    if (documentEntityClass) {
      providers.push({
        provide: DOCUMENT_REPOSITORY,
        useFactory: (repo: Repository<DocumentEntity>): DocumentRepository =>
          new DocumentRepository(repo),
        inject: [
          getRepositoryToken(
            documentEntityClass as new (...args: unknown[]) => unknown
          ),
        ],
      });

      providers.push({
        provide: DocumentRepository,
        useExisting: DOCUMENT_REPOSITORY as unknown as symbol,
      });
    }

    const documentEmbeddingEntityClass = entities.find(
      (e) => e?.name === "DocumentEmbeddingEntity"
    );
    if (documentEmbeddingEntityClass) {
      providers.push({
        provide: DOCUMENT_EMBEDDING_REPOSITORY,
        useFactory: (
          repo: Repository<DocumentEmbeddingEntity>
        ): DocumentEmbeddingRepository => new DocumentEmbeddingRepository(repo),
        inject: [
          getRepositoryToken(
            documentEmbeddingEntityClass as new (...args: unknown[]) => unknown
          ),
        ],
      });

      providers.push({
        provide: DocumentEmbeddingRepository,
        useExisting: DOCUMENT_EMBEDDING_REPOSITORY as unknown as symbol,
      });
    }

    const assistantConversationEntityClass = entities.find(
      (e) => e?.name === "AssistantConversationEntity"
    );
    if (assistantConversationEntityClass) {
      providers.push({
        provide: ASSISTANT_CONVERSATION_REPOSITORY,
        useFactory: (
          repo: Repository<AssistantConversationEntity>
        ): AssistantConversationRepository =>
          new AssistantConversationRepository(repo),
        inject: [
          getRepositoryToken(
            assistantConversationEntityClass as new (
              ...args: unknown[]
            ) => unknown
          ),
        ],
      });

      providers.push({
        provide: AssistantConversationRepository,
        useExisting: ASSISTANT_CONVERSATION_REPOSITORY as unknown as symbol,
      });
    }

    const assistantMessageEntityClass = entities.find(
      (e) => e?.name === "AssistantMessageEntity"
    );
    if (assistantMessageEntityClass) {
      providers.push({
        provide: ASSISTANT_MESSAGE_REPOSITORY,
        useFactory: (
          repo: Repository<AssistantMessageEntity>
        ): AssistantMessageRepository => new AssistantMessageRepository(repo),
        inject: [
          getRepositoryToken(
            assistantMessageEntityClass as new (...args: unknown[]) => unknown
          ),
        ],
      });

      providers.push({
        provide: AssistantMessageRepository,
        useExisting: ASSISTANT_MESSAGE_REPOSITORY as unknown as symbol,
      });
    }

    const agentEntityClass = entities.find((e) => e?.name === "AgentEntity");
    if (agentEntityClass) {
      providers.push({
        provide: AGENT_REPOSITORY,
        useFactory: (repo: Repository<AgentEntity>): AgentRepository =>
          new AgentRepository(repo),
        inject: [
          getRepositoryToken(
            agentEntityClass as new (...args: unknown[]) => unknown
          ),
        ],
      });

      providers.push({
        provide: AgentRepository,
        useExisting: AGENT_REPOSITORY as unknown as symbol,
      });
    }
    const exportsArr: Array<
      | string
      | symbol
      | ((...args: unknown[]) => unknown)
      | DynamicModule
      | Provider
    > = [TypeOrmModule];
    for (const p of providers) {
      const prov = (
        p as Provider & {
          provide?:
            | string
            | symbol
            | ((...args: unknown[]) => unknown)
            | Provider;
        }
      ).provide;
      if (typeof prov !== "undefined")
        exportsArr.push(
          prov as string | symbol | ((...args: unknown[]) => unknown) | Provider
        );
    }
    return {
      module: DatabaseModule,
      // global: true makes all exported repository providers available to every
      // module in the application without needing to re-import DatabaseModule.
      // This mirrors the @Global() decorator on the class itself and is required
      // so that child modules (e.g. AssistantModule) can inject repositories
      // registered by a parent module's DatabaseModule.forFeature call.
      global: true,
      imports: [TypeOrmModule.forFeature(entities)],
      providers,
      exports: exportsArr,
    };
  }
}
