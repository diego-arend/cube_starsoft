import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAssistantConversations1765491517451 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assistant_conversations (
        id uuid PRIMARY KEY,
        session_id varchar NOT NULL UNIQUE,
        user_id uuid,
        title varchar,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_assistant_conversations_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assistant_messages (
        id uuid PRIMARY KEY,
        conversation_id uuid NOT NULL,
        role varchar NOT NULL,
        content text NOT NULL,
        origin varchar,
        metadata jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT fk_assistant_messages_conversation FOREIGN KEY (conversation_id) REFERENCES assistant_conversations(id) ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS assistant_conversations_session_id_idx ON assistant_conversations(session_id);
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS assistant_messages_conversation_id_idx ON assistant_messages(conversation_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS assistant_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS assistant_conversations`);
  }
}
