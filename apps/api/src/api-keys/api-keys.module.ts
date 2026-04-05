import { Module } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [WorkspacesModule, AuditModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
