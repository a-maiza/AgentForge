import { Module } from '@nestjs/common';
import { DatasetsService } from './datasets.service';
import { DatasetsController } from './datasets.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [WorkspacesModule, AuditModule],
  controllers: [DatasetsController],
  providers: [DatasetsService],
  exports: [DatasetsService],
})
export class DatasetsModule {}
