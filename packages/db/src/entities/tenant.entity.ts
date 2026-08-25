import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity('tenant')
export class Tenant {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt!: Date;
}
