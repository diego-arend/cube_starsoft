import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { v7 as uuidv7 } from "uuid";

@Entity({ name: "agents" })
export class AgentEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  @Column({ type: "varchar" })
  name!: string;

  @Column({ type: "text" })
  specialty!: string;

  @Column({ type: "text", nullable: true })
  description?: string | null;

  @Column({ name: "guard_rails", type: "text" })
  guardRails!: string;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
