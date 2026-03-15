import { IsUUID, IsString, IsArray, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreateEvaluationDto {
  @IsUUID()
  promptId!: string;

  @IsUUID()
  promptVersionId!: string;

  @IsUUID()
  datasetId!: string;

  @IsUUID()
  datasetVersionId!: string;

  @IsUUID()
  providerId!: string;

  @IsString()
  modelName!: string;

  @IsOptional()
  @IsObject()
  modelConfig?: Record<string, unknown>;

  @IsArray()
  @IsString({ each: true })
  metrics!: string[];
}

// Suppress unused import warning
void IsNumber;
