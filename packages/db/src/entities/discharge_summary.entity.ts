import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('discharge_summary')
export class DischargeSummary {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'patient_id', type: 'varchar', length: 36 })
  patientId!: string;

  @Column({ name: 'patient_guide', type: 'text' })
  patientGuide!: string;

  @Column({ name: 'doctor_plan', type: 'text' })
  doctorPlan!: string;

  @Column({ name: 'followup_date', type: 'date', nullable: true })
  followupDate!: string;
}
