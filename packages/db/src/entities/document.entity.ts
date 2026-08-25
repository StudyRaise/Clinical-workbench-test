import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('document')
export class Document {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'tenant_id', type: 'varchar', length: 36 })
  tenantId!: string;

  @Column({ name: 'owner_id', type: 'varchar', length: 36 })
  ownerId!: string;

  @Column({ type: 'varchar', length: 50 })
  type!: string;

  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  fileUrl!: string;

  @Column({ type: 'varchar', length: 50 })
  status!: string;
}
