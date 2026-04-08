import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { AgentEntity } from "./agent.entity";
import { UserEntity } from "./user.entity";

@Entity({ name: "documents" })
export class DocumentEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) this.id = uuidv7();
  }

  @Column({ type: "varchar", unique: true })
  key!: string;

  @Column({ name: "owner_id", type: "uuid" })
  ownerId!: string;

  @Column({ name: "original_filename", type: "varchar" })
  originalFilename!: string;

  @Column({ name: "content_type", type: "varchar" })
  contentType!: string;

  @Column({ type: "bigint" })
  size!: number;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @Column({ name: "scan_status", type: "varchar", default: "pending" })
  scanStatus!: string;

  @Column({ name: "is_kb", type: "boolean", default: false })
  isKb!: boolean;

  @Column({ name: "agent_id", type: "uuid", nullable: true })
  agentId?: string | null;

  @ManyToOne(() => AgentEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "agent_id" })
  agent?: AgentEntity | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: "owner_id" })
  owner?: UserEntity | null;
}
