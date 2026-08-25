import { Body, Controller, Param, Post } from '@nestjs/common';
import { KnowledgeService } from './knowledge.service';
import { Audit } from '../audit/audit.decorator';

/**
 * 知识库接口：转发到 FastAPI。
 * - POST /api/knowledge/documents            上传文档 -> /api/knowledge/upload
 * - POST /api/knowledge/documents/:id/ingest  文档摄取 -> /api/knowledge/ingest
 */
@Controller('knowledge/documents')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Audit('knowledge.upload')
  @Post()
  upload(@Body() body: Record<string, unknown>) {
    return this.knowledgeService.uploadDocument(body);
  }

  @Audit('knowledge.ingest')
  @Post(':id/ingest')
  ingest(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.knowledgeService.ingestDocument(id, body);
  }
}
