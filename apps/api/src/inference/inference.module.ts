import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { InferenceService } from './inference.service';
import { InferenceController } from './inference.controller';
import { TenancyModule } from '../tenancy/tenancy.module';

@Module({
  imports: [HttpModule, TenancyModule],
  controllers: [InferenceController],
  providers: [InferenceService],
  exports: [InferenceService]
})
export class InferenceModule {}
