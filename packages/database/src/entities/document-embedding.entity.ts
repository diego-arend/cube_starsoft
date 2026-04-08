import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  BeforeInsert,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";
import { DocumentEntity } from "./document.entity";

@Entity({ name: "document_embeddings" })
export class DocumentEmbeddingEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) this.id = uuidv7();
  }

  @Index()
  @Column({ name: "document_id", type: "uuid" })
  documentId!: string;

  @ManyToOne(() => DocumentEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "document_id" })
  document!: DocumentEntity;

  // TypeORM doesn't have a native 'vector' type, so we use 'any' or 'string' for the column
  // but we'll interact with it via raw SQL in the repository for reliability.
  @Column({ type: "vector", length: 1536 })
  embedding!: any;

  @Column({ type: "text", nullable: true })
  content?: string | null;

  @Column({ type: "jsonb", nullable: true })
  metadata?: Record<string, any> | null;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
