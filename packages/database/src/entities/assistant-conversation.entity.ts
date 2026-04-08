import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { UserEntity } from "./user.entity";
import { AssistantMessageEntity } from "./assistant-message.entity";

@Entity({ name: "assistant_conversations" })
export class AssistantConversationEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  @Index()
  @Column({ name: "session_id", type: "varchar", unique: true })
  sessionId!: string;

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId?: string | null;

  @ManyToOne(() => UserEntity, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "user_id" })
  user?: UserEntity | null;

  @Index()
  @Column({ name: "agent_id", type: "uuid", nullable: true })
  agentId?: string | null;

  @Column({ type: "varchar", nullable: true })
  title?: string | null;

  @OneToMany(() => AssistantMessageEntity, (message) => message.conversation)
  messages!: AssistantMessageEntity[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
