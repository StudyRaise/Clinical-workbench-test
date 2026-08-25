import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CryptoService } from './crypto.service';

/**
 * 全局加密模块：CryptoService 可在任意模块注入。
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CryptoService],
  exports: [CryptoService]
})
export class CryptoModule {}
