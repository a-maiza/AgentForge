import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsController } from './organizations.controller';
import { OrgMemberGuard } from './guards/org-member.guard';

@Module({
  controllers: [OrganizationsController],
  providers: [OrganizationsService, OrgMemberGuard],
  exports: [OrganizationsService, OrgMemberGuard],
})
export class OrganizationsModule {}
