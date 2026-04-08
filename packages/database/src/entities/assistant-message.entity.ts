import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { AssistantConversationEntity } from "./assistant-conversation.entity";

@Entity({ name: "assistant_messages" })
export class AssistantMessageEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  @Index()
  @Column({ name: "conversation_id", type: "uuid" })
  conversationId!: string;

  @ManyToOne(() => AssistantConversationEntity, (conv) => conv.messages, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "conversation_id" })
  conversation!: AssistantConversationEntity;

  @Column({ type: "varchar" })
  role!: "user" | "assistant" | "system";

  @Column({ type: "text" })
  content!: string;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
