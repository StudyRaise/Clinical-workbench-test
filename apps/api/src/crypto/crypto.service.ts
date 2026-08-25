import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  createHash
} from 'crypto';

/**
 * AES-256-GCM 字段加密工具：
 * - key 从 FIELD_ENCRYPTION_KEY 环境变量读取（需 32 字节，否则用其 SHA-256 派生）；
 *   未配置时使用随机 32 字节 key（仅适用于开发环境）。
 * - encrypt(text) -> base64(iv:authTag:ciphertext)
 * - decrypt(cipher) -> text
 * 用于敏感字段（如病历内容、姓名等）在落库前的加密存储。
 */
@Injectable()
export class CryptoService {
  private readonly logger = new Logger(CryptoService.name);
  private readonly key: Buffer;
  /** 开发兜底：随机 key，重启后无法解密历史数据 */
  private readonly fallbackKey = randomBytes(32);

  constructor(config: ConfigService) {
    const raw = config.get<string>('FIELD_ENCRYPTION_KEY');
    if (raw) {
      // 兼容任意长度的密钥：统一派生为 32 字节
      this.key = createHash('sha256').update(raw).digest();
    } else {
      this.logger.warn(
        '未配置 FIELD_ENCRYPTION_KEY，使用随机密钥（仅限开发，重启后无法解密）'
      );
      this.key = this.fallbackKey;
    }
  }

  /** 加密文本，返回 base64(iv:authTag:ciphertext) */
  encrypt(text: string): string {
    const iv = randomBytes(12); // GCM 推荐 12 字节 IV
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  /** 解密 base64(iv:authTag:ciphertext) 为原始文本 */
  decrypt(cipher: string): string {
    const data = Buffer.from(cipher, 'base64');
    const iv = data.subarray(0, 12);
    const authTag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
