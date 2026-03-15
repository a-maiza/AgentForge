import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateDatasetDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsUUID()
  workspaceId!: string;
}
