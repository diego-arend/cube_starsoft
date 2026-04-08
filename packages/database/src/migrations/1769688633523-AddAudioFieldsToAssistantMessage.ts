import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAudioFieldsToAssistantMessage1769688633523 implements MigrationInterface {
  name = "AddAudioFieldsToAssistantMessage1769688633523";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP CONSTRAINT "fk_assistant_conversations_user"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP CONSTRAINT "fk_assistant_messages_conversation"`
    );
    await queryRunner.query(`DROP INDEX "public"."documents_owner_idx"`);
    await queryRunner.query(
      `DROP INDEX "public"."assistant_conversations_session_id_idx"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."assistant_messages_conversation_id_idx"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD "audio_url" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD "audio_mime" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD "audio_size" integer`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD "audio_status" character varying`
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "id" DROP DEFAULT`
    );
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "documents" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP COLUMN "created_at"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP COLUMN "updated_at"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP COLUMN "created_at"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ad8386cb1cda19696c7e653ca0" ON "assistant_conversations" ("session_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_97b4ef2a5d2a5dd3873486a5da" ON "assistant_messages" ("conversation_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD CONSTRAINT "FK_2e2b7063ed2d022d9c8225b1550" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD CONSTRAINT "FK_97b4ef2a5d2a5dd3873486a5dad" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP CONSTRAINT "FK_97b4ef2a5d2a5dd3873486a5dad"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP CONSTRAINT "FK_2e2b7063ed2d022d9c8225b1550"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_97b4ef2a5d2a5dd3873486a5da"`
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ad8386cb1cda19696c7e653ca0"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP COLUMN "created_at"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP COLUMN "updated_at"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" DROP COLUMN "created_at"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`
    );
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "documents" ADD "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP COLUMN "audio_status"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP COLUMN "audio_size"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP COLUMN "audio_mime"`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" DROP COLUMN "audio_url"`
    );
    await queryRunner.query(
      `CREATE INDEX "assistant_messages_conversation_id_idx" ON "assistant_messages" ("conversation_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "assistant_conversations_session_id_idx" ON "assistant_conversations" ("session_id") `
    );
    await queryRunner.query(
      `CREATE INDEX "documents_owner_idx" ON "documents" ("owner_id") `
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_messages" ADD CONSTRAINT "fk_assistant_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`
    );
    await queryRunner.query(
      `ALTER TABLE "assistant_conversations" ADD CONSTRAINT "fk_assistant_conversations_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`
    );
  }
}
