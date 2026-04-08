import { Module } from "@nestjs/common";
import { AssistantGateway } from "./assistant.gateway";
import { AssistantResponseConsumer } from "./assistant-response.consumer";
import { AssistantController } from "./assistant.controller";
import { ConversationService } from "@turborepo/assistant";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "@turborepo/database";
import { MessagingModule } from "@turborepo/messaging";
import { AgentModule } from "../agent/agent.module";
import {
  AssistantConversationEntity,
  AssistantMessageEntity,
} from "@turborepo/database";

@Module({
  imports: [
    ConfigModule,
    MessagingModule,
    DatabaseModule.forFeature([
      AssistantConversationEntity,
      AssistantMessageEntity,
    ]),
    AgentModule,
  ],
  providers: [ConversationService, AssistantGateway, AssistantResponseConsumer],
  controllers: [AssistantController],
})
export class AssistantModule {}
