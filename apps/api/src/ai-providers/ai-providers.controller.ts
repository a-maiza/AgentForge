import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { AiProvidersService } from './ai-providers.service';
import { CreateAiProviderDto } from './dto/create-ai-provider.dto';
import { UpdateAiProviderDto } from './dto/update-ai-provider.dto';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

@Controller('api/workspaces/:workspaceId/ai-providers')
export class AiProvidersController {
  constructor(private readonly aiProviders: AiProvidersService) {}

  @Get()
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.aiProviders.findAll(workspaceId);
  }

  @Get(':id')
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.aiProviders.findOne(id, workspaceId);
  }

  @Post()
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateAiProviderDto,
    @Req() _req: FastifyRequest & { user: User },
  ) {
    return this.aiProviders.create(workspaceId, dto);
  }

  @Put(':id')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateAiProviderDto,
  ) {
    return this.aiProviders.update(id, workspaceId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    await this.aiProviders.delete(id, workspaceId);
  }
}
