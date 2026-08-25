import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';

@Module({
  imports: [ConfigModule],
  controllers: [KnowledgeController],
  providers: [KnowledgeService],
  exports: [KnowledgeService]
})
export class KnowledgeModule {}
