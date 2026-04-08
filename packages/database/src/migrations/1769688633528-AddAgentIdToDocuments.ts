import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from "typeorm";

export class AddAgentIdToDocuments1769688633528 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "documents",
      new TableColumn({
        name: "agent_id",
        type: "uuid",
        isNullable: true,
      })
    );

    await queryRunner.createForeignKey(
      "documents",
      new TableForeignKey({
        name: "FK_documents_agent",
        columnNames: ["agent_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "agents",
        onDelete: "SET NULL",
      })
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_documents_agent_id" ON "documents" ("agent_id")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey("documents", "FK_documents_agent");
    await queryRunner.dropIndex("documents", "IDX_documents_agent_id");
    await queryRunner.dropColumn("documents", "agent_id");
  }
}
