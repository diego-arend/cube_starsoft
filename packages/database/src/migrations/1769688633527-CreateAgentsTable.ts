import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAgentsTable1769688633527 implements MigrationInterface {
  name = "CreateAgentsTable1769688633527";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "agents" ("id" uuid NOT NULL, "name" character varying NOT NULL, "specialty" text NOT NULL, "guard_rails" text NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_856230872251395350c33a216c8" PRIMARY KEY ("id"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "agents"`);
  }
}
