import { MigrationInterface, QueryRunner } from "typeorm";

export class EnsureIsActiveInAgents1769688633531 implements MigrationInterface {
  name = "EnsureIsActiveInAgents1769688633531";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // A coluna is_active já existe via CreateAgentsTable mas algumas inserções manuais ou parciais podem ter ocorrido.
    // Garantimos que ela existe e tem o default correto.
    const hasColumn = await queryRunner.hasColumn("agents", "is_active");
    if (!hasColumn) {
      await queryRunner.query(
        `ALTER TABLE "agents" ADD "is_active" boolean NOT NULL DEFAULT true`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn("agents", "is_active");
    if (hasColumn) {
      await queryRunner.query(`ALTER TABLE "agents" DROP COLUMN "is_active"`);
    }
  }
}
