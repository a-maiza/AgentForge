import { Module } from '@nestjs/common';
import { AiProvidersService } from './ai-providers.service';
import { AiProvidersController } from './ai-providers.controller';
import { EncryptionService } from '../common/services/encryption.service';

@Module({
  controllers: [AiProvidersController],
  providers: [AiProvidersService, EncryptionService],
  exports: [AiProvidersService],
})
export class AiProvidersModule {}
