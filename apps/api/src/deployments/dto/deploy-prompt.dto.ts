import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export type DeploymentEnvironment = 'dev' | 'staging' | 'prod';

export class DeployPromptDto {
  @IsEnum(['dev', 'staging', 'prod'])
  environment!: DeploymentEnvironment;

  @IsUUID()
  promptVersionId!: string;

  @IsUUID()
  @IsOptional()
  providerId?: string;

  @IsUUID()
  @IsOptional()
  secondaryProviderId?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
