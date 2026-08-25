import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('research_record')
export class ResearchRecord {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'patient_key', type: 'varchar', length: 255 })
  patientKey!: string;

  @Column({ type: 'json' })
  variables!: Record<string, unknown>;

  @Column({ type: 'float' })
  confidence!: number;

  @Column({ name: 'source_ref', type: 'varchar', length: 500 })
  sourceRef!: string;
}
