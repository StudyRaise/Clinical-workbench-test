import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 255 })
  target!: string;

  @Column({ type: 'varchar', length: 45 })
  ip!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
