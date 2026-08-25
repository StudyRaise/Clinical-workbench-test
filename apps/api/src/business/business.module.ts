import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BusinessService } from './business.service';
import { PreopController } from './preop.controller';
import { DischargeController } from './discharge.controller';
import { ResearchController } from './research.controller';

@Module({
  imports: [ConfigModule],
  controllers: [PreopController, DischargeController, ResearchController],
  providers: [BusinessService],
  exports: [BusinessService]
})
export class BusinessModule {}
