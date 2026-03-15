import { Controller, Get, Put, Delete, Body, Param, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { PromptAiConfigsService } from './prompt-ai-configs.service';
import { UpsertPromptAiConfigDto } from './dto/upsert-prompt-ai-config.dto';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

@Controller('api/workspaces/:workspaceId/prompts/:promptId/ai-configs')
export class PromptAiConfigsController {
  constructor(private readonly configs: PromptAiConfigsService) {}

  @Get()
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Param('promptId') promptId: string,
  ) {
    return this.configs.findByPrompt(promptId, workspaceId);
  }

  @Put()
  upsert(
    @Param('workspaceId') workspaceId: string,
    @Param('promptId') promptId: string,
    @Body() dto: UpsertPromptAiConfigDto,
    @Req() _req: FastifyRequest & { user: User },
  ) {
    return this.configs.upsert(promptId, workspaceId, dto);
  }

  @Delete(':configId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('promptId') promptId: string,
    @Param('configId') configId: string,
  ) {
    await this.configs.delete(promptId, configId, workspaceId);
  }
}
