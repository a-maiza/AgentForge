import { IsEnum, IsOptional, IsString } from 'class-validator';

export type DeploymentEnvironment = 'dev' | 'staging' | 'prod';

export class PromoteDeploymentDto {
  @IsEnum(['dev', 'staging', 'prod'])
  targetEnvironment!: DeploymentEnvironment;

  @IsString()
  @IsOptional()
  notes?: string;
}
