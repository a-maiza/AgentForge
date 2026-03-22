import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { User } from '@prisma/client';
import { DeploymentsService } from './deployments.service';
import { DeployPromptDto } from './dto/deploy-prompt.dto';
import { PromoteDeploymentDto } from './dto/promote-deployment.dto';

@Controller('api/prompts/:id')
export class DeploymentsController {
  constructor(private readonly deployments: DeploymentsService) {}

  @Get('deployments')
  findAll(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    return this.deployments.findAll(id, req.user.id);
  }

  @Get('deployments/history')
  findHistory(@Param('id') id: string, @Req() req: FastifyRequest & { user: User }) {
    return this.deployments.findHistory(id, req.user.id);
  }

  @Post('deploy')
  @HttpCode(HttpStatus.CREATED)
  deploy(
    @Param('id') id: string,
    @Body() dto: DeployPromptDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.deployments.deploy(id, dto, req.user.id);
  }

  @Post('promote')
  @HttpCode(HttpStatus.OK)
  promote(
    @Param('id') id: string,
    @Body() dto: PromoteDeploymentDto,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.deployments.promote(id, dto, req.user.id);
  }

  @Post('rollback/:environment')
  @HttpCode(HttpStatus.OK)
  rollback(
    @Param('id') id: string,
    @Param('environment') environment: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.deployments.rollback(id, environment, req.user.id);
  }

  @Post('go-live/:environment')
  @HttpCode(HttpStatus.OK)
  goLive(
    @Param('id') id: string,
    @Param('environment') environment: string,
    @Req() req: FastifyRequest & { user: User },
  ) {
    return this.deployments.goLive(id, environment, req.user.id);
  }
}
