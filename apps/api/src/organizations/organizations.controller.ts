import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { OrganizationsService } from './organizations.service';
import { OrgMemberGuard } from './guards/org-member.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
  type CreateOrganizationInput,
  type UpdateOrganizationInput,
} from '@agentforge/shared';
import type { User } from '@prisma/client';

@Controller('api/organizations')
export class OrganizationsController {
  constructor(private readonly orgsService: OrganizationsService) {}

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.orgsService.findAllForUser(user.id);
  }

  @Get(':orgId')
  @UseGuards(OrgMemberGuard)
  findOne(@Param('orgId') orgId: string) {
    return this.orgsService.findById(orgId);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateOrganizationSchema)) body: CreateOrganizationInput,
    @CurrentUser() user: User,
  ) {
    return this.orgsService.create(body, user);
  }

  @Put(':orgId')
  @UseGuards(OrgMemberGuard)
  update(
    @Param('orgId') orgId: string,
    @Body(new ZodValidationPipe(UpdateOrganizationSchema)) body: UpdateOrganizationInput,
    @CurrentUser() user: User,
  ) {
    return this.orgsService.update(orgId, body, user.id);
  }

  @Delete(':orgId')
  @UseGuards(OrgMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@Param('orgId') orgId: string, @CurrentUser() user: User) {
    return this.orgsService.delete(orgId, user.id);
  }

  @Get(':orgId/members')
  @UseGuards(OrgMemberGuard)
  getMembers(@Param('orgId') orgId: string) {
    return this.orgsService.getMembers(orgId);
  }

  @Post(':orgId/members')
  @UseGuards(OrgMemberGuard)
  addMember(
    @Param('orgId') orgId: string,
    @Body() body: { userId: string; role: string },
    @CurrentUser() user: User,
  ) {
    return this.orgsService.addMember(orgId, body.userId, body.role, user.id);
  }

  @Delete(':orgId/members/:userId')
  @UseGuards(OrgMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('orgId') orgId: string,
    @Param('userId') targetUserId: string,
    @CurrentUser() user: User,
  ) {
    return this.orgsService.removeMember(orgId, targetUserId, user.id);
  }
}
