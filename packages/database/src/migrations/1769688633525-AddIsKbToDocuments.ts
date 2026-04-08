import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsKbToDocuments1769688633525 implements MigrationInterface {
  name = "AddIsKbToDocuments1769688633525";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" ADD "is_kb" boolean NOT NULL DEFAULT false`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "is_kb"`);
  }
}
