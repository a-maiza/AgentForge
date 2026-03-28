import { IsString, IsOptional, IsBoolean, IsIn, IsUUID } from 'class-validator';

const PROVIDER_TYPES = [
  'openai',
  'togetherai',
  'mistral',
  'anthropic',
  'groq',
  'ollama',
  'custom',
] as const;

export class CreateAiProviderDto {
  @IsOptional()
  @IsUUID()
  workspaceId?: string;

  @IsString()
  name!: string;

  @IsIn(PROVIDER_TYPES)
  providerType!: string;

  @IsString()
  apiKey!: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
