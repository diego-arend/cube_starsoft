import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDescriptionToAgents1769688633530 implements MigrationInterface {
  name = "AddDescriptionToAgents1769688633530";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents" 
      ADD COLUMN IF NOT EXISTS "description" TEXT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "agents" 
      DROP COLUMN IF EXISTS "description";
    `);
  }
}
