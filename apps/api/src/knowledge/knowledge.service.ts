import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** FastAPI 业务转发统一使用 INFERENCE_URL 环境变量，默认 localhost:8000 */
export function getInferenceBaseUrl(config: ConfigService): string {
  return config.get<string>('INFERENCE_URL', 'http://localhost:8000').replace(/\/$/, '');
}

/**
 * 知识库服务：把文档上传 / 摄取请求转发到 FastAPI 服务
 * （localhost:8000/api/knowledge/upload、/api/knowledge/ingest）。
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

  /** 转发文档上传 */
  async uploadDocument(body: unknown) {
    return this.forward('/api/knowledge/upload', body);
  }

  /** 转发文档摄取 */
  async ingestDocument(documentId: string, body: unknown) {
    return this.forward(`/api/knowledge/ingest`, { documentId, ...(body as object) });
  }

  /** 通用 fetch 转发 */
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
}
