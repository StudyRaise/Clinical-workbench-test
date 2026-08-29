import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { KnowledgeService } from './knowledge.service';
import {
  KnowledgeChatController,
  KnowledgeController,
  KnowledgeDatasetsController
} from './knowledge.controller';

@Module({
  imports: [ConfigModule],
  controllers: [KnowledgeController, KnowledgeChatController, KnowledgeDatasetsController],
  providers: [KnowledgeService],
  exports: [KnowledgeService]
})
export class KnowledgeModule {}
