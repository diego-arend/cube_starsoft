import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveAudioFieldsFromAssistantMessage1769688633526 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assistant_messages" 
      DROP COLUMN IF EXISTS "origin",
      DROP COLUMN IF EXISTS "audio_url",
      DROP COLUMN IF EXISTS "audio_mime",
      DROP COLUMN IF EXISTS "audio_size",
      DROP COLUMN IF EXISTS "audio_status";
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "assistant_messages" 
      ADD COLUMN "origin" varchar,
      ADD COLUMN "audio_url" varchar,
      ADD COLUMN "audio_mime" varchar,
      ADD COLUMN "audio_size" integer,
      ADD COLUMN "audio_status" varchar;
    `);
  }
}
