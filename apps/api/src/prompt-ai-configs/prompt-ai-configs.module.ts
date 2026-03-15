import { Module } from '@nestjs/common';
import { PromptAiConfigsService } from './prompt-ai-configs.service';
import { PromptAiConfigsController } from './prompt-ai-configs.controller';

@Module({
  controllers: [PromptAiConfigsController],
  providers: [PromptAiConfigsService],
})
export class PromptAiConfigsModule {}
