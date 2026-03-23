import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { MonitoringGateway } from './monitoring.gateway';

@Module({
  controllers: [MonitoringController],
  providers: [MonitoringService, MonitoringGateway],
  exports: [MonitoringService],
})
export class MonitoringModule {}
