import { IsUUID, IsString, IsArray, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreateEvaluationDto {
  @IsUUID()
  promptId!: string;

  @IsUUID()
  promptVersionId!: string;

  @IsOptional()
  @IsUUID()
  datasetId?: string;

  @IsOptional()
  @IsUUID()
  datasetVersionId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsObject()
  modelConfig?: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  metrics!: string[];
}

// Suppress unused import warning
void IsNumber;
