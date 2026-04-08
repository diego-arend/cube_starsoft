import {
  Entity,
  PrimaryColumn,
  BeforeInsert,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm";
import { UserRole } from "../enums/user-role.enum";
import { v7 as uuidv7 } from "uuid";

@Entity({ name: "users" })
export class UserEntity {
  @PrimaryColumn("uuid")
  id!: string;

  @BeforeInsert()
  ensureId(): void {
    if (!this.id) {
      this.id = uuidv7();
    }
  }

  @Column({ type: "varchar", unique: true })
  email!: string;

  @Column({ type: "varchar", nullable: true })
  name?: string | null;

  @Column({ name: "password_hash", type: "varchar", nullable: true })
  passwordHash?: string | null;

  @Column({ type: "enum", enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;

  // Using the 'uuid' package v7 generator instead of in-repo function.
}
