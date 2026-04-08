import { DynamicModule, Module, Provider } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "@turborepo/database";
import {
  AssistantConversationEntity,
  AssistantMessageEntity,
} from "@turborepo/database";
import { ConversationService } from "./services/conversation.service";
import { AssistantService } from "./services/assistant.service";
import { KNOWLEDGE_BASE_SERVICE, AGENT_SERVICE } from "./types";

export interface AssistantModuleOptions {
  /**
   * Optional providers for KnowledgeBaseService and AgentService.
   * When provided (typically by the worker), full RAG and per-agent
   * configuration is enabled.
   */
  extraProviders?: Provider[];
}

@Module({})
export class AssistantModule {
  static forRoot(options: AssistantModuleOptions = {}): DynamicModule {
    const { extraProviders = [] } = options;

    return {
      module: AssistantModule,
      imports: [
        ConfigModule,
        // Register only the entities this module directly needs.
        // DatabaseModule.forFeature has global:true so if a parent module
        // (e.g. AssistantWorkerModule) also registers these entities, the
        // duplicate registration is harmless — last write wins with equivalent value.
        DatabaseModule.forFeature([
          AssistantConversationEntity,
          AssistantMessageEntity,
        ]),
      ],
      providers: [
        ConversationService,
        AssistantService,
        // Null defaults — overridden via extraProviders when RAG/agent support is needed.
        { provide: KNOWLEDGE_BASE_SERVICE, useValue: null },
        { provide: AGENT_SERVICE, useValue: null },
        ...extraProviders,
      ],
      exports: [ConversationService, AssistantService],
    };
  }
}
