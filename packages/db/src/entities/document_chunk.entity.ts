import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('document_chunk')
export class DocumentChunk {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id!: string;

  @Column({ name: 'document_id', type: 'varchar', length: 36 })
  documentId!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'embedding_id', type: 'varchar', length: 36 })
  embeddingId!: string;
}
