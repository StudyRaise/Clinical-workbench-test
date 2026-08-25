import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('preop_report')
export class PreopReport {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'document_id', type: 'varchar', length: 36 })
  documentId!: string;

  @Column({ name: 'missing_items', type: 'json' })
  missingItems!: string[];

  @Column({ name: 'risk_points', type: 'json' })
  riskPoints!: string[];

  @Column({ name: 'questions', type: 'json' })
  questions!: string[];

  @Column({ type: 'float' })
  score!: number;
}
