import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import { FailoverConfigsService } from './failover-configs.service';
import { UpsertFailoverConfigDto } from './dto/upsert-failover-config.dto';

@Controller('api/prompts/:id/failover-config')
export class FailoverConfigsController {
  constructor(private readonly failoverConfigs: FailoverConfigsService) {}

  @Get()
  findOne(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    return this.failoverConfigs.findOne(id, req.user.id);
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  upsert(
    @Param('id') id: string,
    @Body() dto: UpsertFailoverConfigDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.failoverConfigs.upsert(id, dto, req.user.id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    return this.failoverConfigs.remove(id, req.user.id);
  }
}
