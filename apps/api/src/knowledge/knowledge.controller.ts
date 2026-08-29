import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';
import { Audit } from '../audit/audit.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';

/**
 * 知识库接口：转发到 FastAPI。
 * - POST /api/knowledge/documents            上传文档（multipart）-> /api/knowledge/upload
 * - POST /api/knowledge/documents/ingest     文档摄取（JSON，object_name）-> /api/knowledge/ingest
 * - POST /api/knowledge/documents/:id/ingest 兼容旧路径（:id 作 object_name，含斜杠请走上一接口）
 */
@ApiTags('知识库')
@ApiBearerAuth('access-token')
@Controller('knowledge/documents')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Audit('knowledge.upload')
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: '上传文档', description: '上传文档到知识库，转发至 FastAPI 处理。' })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('bucket') bucket?: string
  ) {
    return this.knowledgeService.uploadDocument(file, { bucket });
  }

  @Audit('knowledge.ingest')
  @Post('ingest')
  @ApiOperation({ summary: '文档摄取', description: '对指定 object_name 执行摄取/解析，转发至 FastAPI 处理。' })
  ingest(@Body() body: { object_name: string; bucket?: string; metadata?: Record<string, unknown> }) {
    return this.knowledgeService.ingestDocument(body);
  }

  @Audit('knowledge.ingest')
  @Post(':id/ingest')
  @ApiOperation({ summary: '文档摄取（兼容）', description: '兼容旧路径，:id 作为 object_name。' })
  ingestLegacy(
    @Param('id') id: string,
    @Body() body: { bucket?: string; metadata?: Record<string, unknown> }
  ) {
    return this.knowledgeService.ingestDocument({ object_name: id, ...body });
  }
}

/**
 * 知识库问答：转发到 FastAPI -> SenseCore RAG chat-release。
 * - POST /api/knowledge/chat
 */
@ApiTags('知识库')
@ApiBearerAuth('access-token')
@Controller('knowledge/chat')
export class KnowledgeChatController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Audit('knowledge.chat')
  @Post()
  @ApiOperation({ summary: '知识库问答', description: '基于 SenseCore RAG 发布应用进行知识库问答。' })
  chat(@Body() body: { content: string; conversation_id?: string }) {
    return this.knowledgeService.chatDocument(body);
  }
}

/**
 * 线上知识库（SenseCore 数据集）管理与流式问答。
 * - GET    /api/knowledge/datasets         列出线上知识库
 * - POST   /api/knowledge/datasets         创建线上知识库
 * - DELETE /api/knowledge/datasets/:id     删除线上知识库
 * - POST   /api/knowledge/chat/stream      SSE 流式问答
 */
@ApiTags('知识库')
@ApiBearerAuth('access-token')
@Controller('knowledge')
export class KnowledgeDatasetsController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Audit('knowledge.datasets.list')
  @Get('datasets')
  @ApiOperation({ summary: '列出线上知识库', description: '拉取 SenseCore 知识库（数据集）列表。' })
  listDatasets() {
    return this.knowledgeService.listDatasets();
  }

  @Audit('knowledge.datasets.create')
  @Post('datasets')
  @ApiOperation({ summary: '创建线上知识库', description: '在 SenseCore 创建知识库（数据集）。' })
  createDataset(@Body() body: { display_name: string; desc?: string }) {
    return this.knowledgeService.createDataset(body);
  }

  @Audit('knowledge.datasets.delete')
  @Delete('datasets/:id')
  @ApiOperation({ summary: '删除线上知识库', description: '删除 SenseCore 知识库（数据集）。' })
  deleteDataset(@Param('id') id: string) {
    return this.knowledgeService.deleteDataset(id);
  }

  @Audit('knowledge.datasets.upload')
  @Post('datasets/:id/documents')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: '上传文档到线上知识库',
    description: '创建导入任务 -> 预签名直传 -> 启动任务，云端解析分段。'
  })
  uploadDatasetDocument(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.knowledgeService.uploadDatasetDocument(id, file);
  }

  @Audit('knowledge.datasets.documents.list')
  @Get('datasets/:id/documents')
  @ApiOperation({ summary: '列出知识库文档', description: '列出 SenseCore 线上知识库中的文档。' })
  listDatasetDocuments(@Param('id') id: string) {
    return this.knowledgeService.listDatasetDocuments(id);
  }

  @Audit('knowledge.datasets.documents.delete')
  @Delete('datasets/:id/documents/:docId')
  @ApiOperation({ summary: '删除知识库文档', description: '删除 SenseCore 线上知识库中的指定文档。' })
  deleteDatasetDocument(@Param('id') id: string, @Param('docId') docId: string) {
    return this.knowledgeService.deleteDatasetDocument(id, docId);
  }

  @Audit('knowledge.chat.stream')
  @Post('chat/stream')
  @ApiOperation({ summary: '知识库流式问答', description: 'SSE 流式返回知识库问答结果。' })
  chatStream(@Body() body: { content: string; conversation_id?: string }, @Res() res: Response) {
    return this.knowledgeService.chatStream(body, res);
  }
}
