import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('research_variable')
export class ResearchVariable {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 100 })
  type!: string;

  @Column({ name: 'standard_code', type: 'varchar', length: 255 })
  standardCode!: string;
}
