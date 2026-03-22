import { Module } from '@nestjs/common';
import { FailoverConfigsService } from './failover-configs.service';
import { FailoverConfigsController } from './failover-configs.controller';

@Module({
  controllers: [FailoverConfigsController],
  providers: [FailoverConfigsService],
  exports: [FailoverConfigsService],
})
export class FailoverConfigsModule {}
