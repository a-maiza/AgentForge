import { IsString, IsUUID, IsOptional, IsNumber, IsBoolean, Min, Max, IsArray } from 'class-validator';

export class UpsertPromptAiConfigDto {
  @IsUUID()
  providerId!: string;

  @IsString()
  modelName!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  topP?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  topK?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxTokens?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// Suppress unused import warning
void IsArray;
