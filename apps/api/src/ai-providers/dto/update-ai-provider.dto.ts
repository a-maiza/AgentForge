import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdateAiProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['openai', 'togetherai', 'mistral', 'anthropic', 'groq', 'ollama', 'custom'])
  providerType?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
