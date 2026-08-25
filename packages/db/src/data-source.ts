import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { User } from './entities/user.entity';
import { Document } from './entities/document.entity';
import { DocumentChunk } from './entities/document_chunk.entity';
import { AuditLog } from './entities/audit_log.entity';
import { PreopReport } from './entities/preop_report.entity';
import { DischargeSummary } from './entities/discharge_summary.entity';
import { ResearchRecord } from './entities/research_record.entity';
import { ResearchVariable } from './entities/research_variable.entity';

export const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'clinical_workbench',
  entities: [
    Tenant,
    User,
    Document,
    DocumentChunk,
    AuditLog,
    PreopReport,
    DischargeSummary,
    ResearchRecord,
    ResearchVariable
  ],
  synchronize: true,
  charset: 'utf8mb4'
});
