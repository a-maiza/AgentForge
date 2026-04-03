import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from './dto/create-evaluation.dto';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';

@Controller('api/evaluations')
export class EvaluationsController {
  constructor(private readonly evaluations: EvaluationsService) {}

  @Get()
  findAll(@Query('status') status?: string, @Query('promptId') promptId?: string) {
    return this.evaluations.findAll({
      ...(status !== undefined && { status }),
      ...(promptId !== undefined && { promptId }),
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.evaluations.findOne(id);
  }

  @Get(':id/traces')
  getTraces(@Param('id') id: string) {
    return this.evaluations.getTraces(id);
  }

  @Post()
  create(@Body() dto: CreateEvaluationDto, @Req() req: FastifyRequest & { user: User }) {
    return this.evaluations.create(dto, req.user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id') id: string) {
    return this.evaluations.cancel(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.evaluations.remove(id);
  }
}
