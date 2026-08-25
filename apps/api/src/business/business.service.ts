import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getInferenceBaseUrl } from '../knowledge/knowledge.service';

/** 错误降级返回结构 */
export interface DegradedResponse {
  ok: false;
  degraded: true;
  reason: string;
  service: string;
}

/**
 * 业务转发服务：把临床业务请求转发到 FastAPI（INFERENCE_URL，默认 localhost:8000）。
 * 提供 fetch 转发 + 超时控制 + 错误降级（FastAPI 不可用时返回 degraded 响应而非抛错）。
 */
@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = getInferenceBaseUrl(config);
    this.timeoutMs = config.get<number>('FORWARD_TIMEOUT_MS', 30000);
  }

  /** 术前评估分析 -> /api/preop/analyze */
  async analyzePreop(body: unknown) {
    return this.forward('/api/preop/analyze', body, 'preop');
  }

  /** 出院小结生成 -> /api/discharge/summarize */
  async summarizeDischarge(body: unknown) {
    return this.forward('/api/discharge/summarize', body, 'discharge');
  }

  /** 科研数据清洗 -> /api/research/clean */
  async cleanResearch(body: unknown) {
    return this.forward('/api/research/clean', body, 'research');
  }

  /** 通用转发：超时/失败时降级返回，保证 BFF 自身不崩溃 */
  private async forward(
    path: string,
    body: unknown,
    service: string
  ): Promise<unknown | DegradedResponse> {
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
        // 降级：FastAPI 返回非 2xx 时把状态码带回
        return {
          ok: false,
          degraded: true,
          reason: `上游服务返回 ${res.status}`,
          service
        } satisfies DegradedResponse;
      }
      return await res.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`业务转发降级 [${service}] ${path}: ${message}`);
      return {
        ok: false,
        degraded: true,
        reason: `上游服务不可用: ${message}`,
        service
      } satisfies DegradedResponse;
    } finally {
      clearTimeout(timer);
    }
  }
}
