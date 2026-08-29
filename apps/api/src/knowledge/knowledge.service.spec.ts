import { ConfigService } from '@nestjs/config';
import { decodeUploadFilename, getInferenceBaseUrl } from './knowledge.service';

describe('getInferenceBaseUrl', () => {
  const configWith = (value?: string) =>
    ({ get: (_key: string, def: string) => value ?? def }) as unknown as ConfigService;

  it('未配置时默认 localhost:8000', () => {
    expect(getInferenceBaseUrl(configWith())).toBe('http://localhost:8000');
  });

  it('使用配置值并去除末尾斜杠', () => {
    expect(getInferenceBaseUrl(configWith('http://inference:8000/'))).toBe('http://inference:8000');
  });
});

describe('decodeUploadFilename', () => {
  it('latin1 解码的中文文件名还原为 UTF-8', () => {
    // multer 会把 UTF-8 字节按 latin1 解码，这里模拟并还原
    const garbled = Buffer.from('手术知情同意书.docx', 'utf8').toString('latin1');
    expect(decodeUploadFilename(garbled)).toBe('手术知情同意书.docx');
  });

  it('纯 ASCII 文件名不受影响', () => {
    expect(decodeUploadFilename('report.pdf')).toBe('report.pdf');
  });
});
