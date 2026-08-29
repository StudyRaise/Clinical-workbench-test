import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

/** FastAPI 业务转发统一使用 INFERENCE_URL 环境变量，默认 localhost:8000 */
export function getInferenceBaseUrl(config: ConfigService): string {
  return config.get<string>('INFERENCE_URL', 'http://localhost:8000').replace(/\/$/, '');
}

export interface IngestPayload {
  object_name: string;
  bucket?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatPayload {
  content: string;
  conversation_id?: string;
}

/**
 * 知识库服务：把文档上传 / 摄取请求转发到 FastAPI 服务
 * （localhost:8000/api/knowledge/upload、/api/knowledge/ingest）。
 * 上传使用 multipart/form-data（FastAPI upload 接收 UploadFile），
 * 摄取使用 JSON（FastAPI ingest 接收 object_name）。
 * 使用原生 fetch + AbortController 实现超时控制。
 */
@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = getInferenceBaseUrl(config);
    this.timeoutMs = config.get<number>('FORWARD_TIMEOUT_MS', 30000);
  }

  /** multer 按 latin1 解码文件名，中文需转回 UTF-8 */
  private decodeFilename(name: string): string {
    return Buffer.from(name, 'latin1').toString('utf8');
  }

  /** 转发文档上传（multipart） */
  async uploadDocument(file: Express.Multer.File, body: { bucket?: string }) {
    const form = new FormData();
    if (file) {
      form.append(
        'file',
        new Blob([file.buffer], { type: file.mimetype }),
        this.decodeFilename(file.originalname)
      );
    }
    if (body.bucket) {
      form.append('bucket', body.bucket);
    }
    return this.forwardForm('/api/knowledge/upload', form);
  }

  /** 转发文档摄取（JSON） */
  async ingestDocument(payload: IngestPayload) {
    return this.forward('/api/knowledge/ingest', payload);
  }

  /** 转发知识库问答（JSON，SenseCore RAG chat-release） */
  async chatDocument(payload: ChatPayload) {
    return this.forward('/api/knowledge/chat', payload);
  }

  /** 转发知识库问答（SSE 流式，代理透传） */
  async chatStream(payload: ChatPayload, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const writeError = (message: string) =>
      res.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    try {
      const upstream = await fetch(`${this.baseUrl}/api/knowledge/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!upstream.ok || !upstream.body) {
        const text = await upstream.text();
        writeError(`FastAPI 转发失败: ${upstream.status} ${text.slice(0, 120)}`);
        res.end();
        return;
      }
      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`知识库流式转发失败: ${message}`);
      writeError(`知识库流式服务暂不可用: ${message}`);
      res.end();
    } finally {
      clearTimeout(timer);
    }
  }

  /** 列出线上知识库（SenseCore 数据集） */
  async listDatasets() {
    return this.forwardGet('/api/knowledge/datasets');
  }

  /** 创建线上知识库 */
  async createDataset(body: { display_name: string; desc?: string }) {
    return this.forward('/api/knowledge/datasets', body);
  }

  /** 删除线上知识库 */
  async deleteDataset(datasetId: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(
        `${this.baseUrl}/api/knowledge/datasets/${encodeURIComponent(datasetId)}`,
        { method: 'DELETE', signal: controller.signal }
      );
      if (!res.ok) {
        throw new ServiceUnavailableException(
          `FastAPI 转发失败: /datasets/${datasetId} 返回 ${res.status}`
        );
      }
      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`转发删除知识库失败: ${message}`);
      throw new ServiceUnavailableException(`知识库服务暂不可用: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** 上传文档到线上知识库（multipart 转发） */
  async uploadDatasetDocument(datasetId: string, file: Express.Multer.File) {
    const form = new FormData();
    form.append(
      'file',
      new Blob([file.buffer], { type: file.mimetype }),
      this.decodeFilename(file.originalname)
    );
    return this.forwardForm(
      `/api/knowledge/datasets/${encodeURIComponent(datasetId)}/documents`,
      form
    );
  }

  /** 列出线上知识库中的文档 */
  async listDatasetDocuments(datasetId: string) {
    return this.forwardGet(`/api/knowledge/datasets/${encodeURIComponent(datasetId)}/documents`);
  }

  /** 删除线上知识库中的文档 */
  async deleteDatasetDocument(datasetId: string, documentId: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(
        `${this.baseUrl}/api/knowledge/datasets/${encodeURIComponent(datasetId)}/documents/${encodeURIComponent(documentId)}`,
        { method: 'DELETE', signal: controller.signal }
      );
      if (!res.ok) {
        throw new ServiceUnavailableException(
          `FastAPI 转发失败: /datasets/${datasetId}/documents/${documentId} 返回 ${res.status}`
        );
      }
      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`转发删除知识库文档失败: ${message}`);
      throw new ServiceUnavailableException(`知识库服务暂不可用: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** GET 转发 */
  private async forwardGet(path: string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, { signal: controller.signal });
      if (!res.ok) {
        throw new ServiceUnavailableException(`FastAPI 转发失败: ${path} 返回 ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`转发 ${path} 失败: ${message}`);
      throw new ServiceUnavailableException(`知识库服务暂不可用: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** JSON 转发 */
  private async forward(path: string, body: unknown): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!res.ok) {
        throw new ServiceUnavailableException(
          `FastAPI 转发失败: ${path} 返回 ${res.status}`
        );
      }
      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`转发 ${path} 失败: ${message}`);
      throw new ServiceUnavailableException(`知识库服务暂不可用: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  /** multipart 转发（Content-Type 由 fetch 自动附带 boundary） */
  private async forwardForm(path: string, form: FormData): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        body: form,
        signal: controller.signal
      });
      if (!res.ok) {
        throw new ServiceUnavailableException(
          `FastAPI 转发失败: ${path} 返回 ${res.status}`
        );
      }
      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`转发 ${path} 失败: ${message}`);
      throw new ServiceUnavailableException(`知识库服务暂不可用: ${message}`);
    } finally {
      clearTimeout(timer);
    }
  }
}
