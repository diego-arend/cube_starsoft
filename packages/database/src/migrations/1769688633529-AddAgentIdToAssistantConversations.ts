import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAgentIdToAssistantConversations1769688633529 implements MigrationInterface {
  name = "AddAgentIdToAssistantConversations1769688633529";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assistant_conversations" 
      ADD COLUMN IF NOT EXISTS "agent_id" UUID NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_assistant_conversations_agent_id" 
      ON "assistant_conversations"("agent_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_assistant_conversations_agent_id";
    `);

    await queryRunner.query(`
      ALTER TABLE "assistant_conversations" 
      DROP COLUMN IF EXISTS "agent_id";
    `);
  }
}
