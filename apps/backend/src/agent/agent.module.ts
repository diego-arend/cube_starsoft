import { Module } from "@nestjs/common";
import { DatabaseModule, AgentEntity } from "@turborepo/database";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";

@Module({
  imports: [DatabaseModule.forFeature([AgentEntity])],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
