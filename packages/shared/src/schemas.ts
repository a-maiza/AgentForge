import { z } from 'zod';
import { ProviderType, UserRole, VariableType } from './constants.js';

// ─── Common ───────────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const UuidSchema = z.string().uuid();

// ─── Organizations & Workspaces ───────────────────────────────────────────────

export const CreateOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;

export const UpdateOrganizationSchema = CreateOrganizationSchema.partial();
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;

export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum([UserRole.ADMIN, UserRole.DEVELOPER, UserRole.VIEWER, UserRole.API_USER] as const),
});
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;

// ─── Prompts ─────────────────────────────────────────────────────────────────

export const PromptVariableSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Variable name must be a valid identifier'),
  type: z.enum([
    VariableType.STRING,
    VariableType.NUMBER,
    VariableType.BOOLEAN,
    VariableType.ARRAY,
    VariableType.OBJECT,
  ] as const),
  description: z.string().max(500).optional(),
  defaultValue: z.string().optional(),
});

export const CreatePromptSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  workspaceId: UuidSchema,
  content: z.string().min(1),
  variables: z.array(PromptVariableSchema).optional(),
});
export type CreatePromptInput = z.infer<typeof CreatePromptSchema>;

export const UpdatePromptSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  content: z.string().min(1).optional(),
  variables: z.array(PromptVariableSchema).optional(),
});
export type UpdatePromptInput = z.infer<typeof UpdatePromptSchema>;

export const PromptDatasetConfigSchema = z.object({
  datasetId: UuidSchema,
  datasetVersionId: UuidSchema,
  variableMapping: z.record(z.string(), z.string()),
});
export type PromptDatasetConfigInput = z.infer<typeof PromptDatasetConfigSchema>;

// ─── Datasets ────────────────────────────────────────────────────────────────

export const CreateDatasetSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  workspaceId: UuidSchema,
});
export type CreateDatasetInput = z.infer<typeof CreateDatasetSchema>;

export const UpdateDatasetSchema = CreateDatasetSchema.omit({ workspaceId: true }).partial();
export type UpdateDatasetInput = z.infer<typeof UpdateDatasetSchema>;

export const DatasetVersionCompareSchema = z.object({
  versionA: z.number().int().min(1),
  versionB: z.number().int().min(1),
});
export type DatasetVersionCompareInput = z.infer<typeof DatasetVersionCompareSchema>;

// ─── AI Providers ─────────────────────────────────────────────────────────────

export const CreateAiProviderSchema = z.object({
  name: z.string().min(1).max(255),
  providerType: z.enum([
    ProviderType.OPENAI,
    ProviderType.TOGETHERAI,
    ProviderType.MISTRAL,
    ProviderType.ANTHROPIC,
    ProviderType.GROQ,
    ProviderType.OLLAMA,
    ProviderType.CUSTOM,
  ] as const),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  workspaceId: UuidSchema,
});
export type CreateAiProviderInput = z.infer<typeof CreateAiProviderSchema>;

export const UpdateAiProviderSchema = CreateAiProviderSchema.omit({ workspaceId: true }).partial();
export type UpdateAiProviderInput = z.infer<typeof UpdateAiProviderSchema>;

export const PromptAiConfigSchema = z.object({
  providerId: UuidSchema,
  modelName: z.string().min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  topP: z.number().min(0).max(1).default(1.0),
  topK: z.number().int().min(1).default(40),
  maxTokens: z.number().int().min(1).max(128000).default(1000),
  repetitionPenalty: z.number().min(0).max(2).default(1.0),
  frequencyPenalty: z.number().min(0).max(2).optional(),
  stopSequences: z.array(z.string()).max(4).default([]),
});
export type PromptAiConfigInput = z.infer<typeof PromptAiConfigSchema>;

// ─── Evaluations ─────────────────────────────────────────────────────────────

export const CreateEvaluationSchema = z.object({
  promptId: UuidSchema,
  promptVersionId: UuidSchema,
  datasetId: UuidSchema,
  datasetVersionId: UuidSchema,
  metrics: z.array(z.string()).min(1, 'Select at least one metric'),
});
export type CreateEvaluationInput = z.infer<typeof CreateEvaluationSchema>;

export const MetricSuggestSchema = z.object({
  promptId: UuidSchema,
  promptContent: z.string().min(1),
});
export type MetricSuggestInput = z.infer<typeof MetricSuggestSchema>;

// ─── Deployments ─────────────────────────────────────────────────────────────

export const DeployPromptSchema = z.object({
  environment: z.enum(['dev', 'staging', 'prod'] as const),
  promptVersionId: UuidSchema,
  providerId: UuidSchema,
  secondaryProviderId: UuidSchema.optional(),
});
export type DeployPromptInput = z.infer<typeof DeployPromptSchema>;

export const FailoverConfigSchema = z.object({
  isEnabled: z.boolean().default(true),
  timeoutMs: z.number().int().min(1000).max(120000).default(30000),
  errorThreshold: z.number().int().min(1).max(100).default(3),
  maxLatencyMs: z.number().int().min(100).max(60000).default(5000),
  autoRecovery: z.boolean().default(true),
  recoveryCheckIntervalMs: z.number().int().min(10000).default(300000),
});
export type FailoverConfigInput = z.infer<typeof FailoverConfigSchema>;

// ─── API Keys ─────────────────────────────────────────────────────────────────

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(255),
  scope: z.enum(['organization', 'workspace', 'readonly'] as const),
  workspaceId: UuidSchema.optional(),
  orgId: UuidSchema.optional(),
  rateLimitPerMin: z.number().int().min(1).max(10000).default(60),
  rateLimitPerDay: z.number().int().min(1).max(10000000).default(10000),
  expiresAt: z.string().datetime().optional(),
});
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;

// ─── Agents ──────────────────────────────────────────────────────────────────

export const CreateAgentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  workspaceId: UuidSchema,
});
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;

export const WorkflowNodeSchema: z.ZodType<{
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label: string; nodeType: string; config: Record<string, unknown> };
}> = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    nodeType: z.string(),
    config: z.record(z.unknown()),
  }),
});

export const SaveWorkflowSchema = z.object({
  nodes: z.array(WorkflowNodeSchema),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().nullable().optional(),
      targetHandle: z.string().nullable().optional(),
    }),
  ),
});
export type SaveWorkflowInput = z.infer<typeof SaveWorkflowSchema>;

export const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  status: z.enum(['draft', 'live', 'archived']).optional(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentSchema>;

// Looser schema for workflow JSONB storage (accepts arbitrary React Flow node/edge shapes)
export const WorkflowDefinitionSchema = z.object({
  nodes: z.array(z.record(z.string(), z.unknown())),
  edges: z.array(z.record(z.string(), z.unknown())),
});
export type WorkflowDefinitionInput = z.infer<typeof WorkflowDefinitionSchema>;

// ─── Proxy / Live endpoint ────────────────────────────────────────────────────

export const LiveEndpointRequestSchema = z.object({}).catchall(z.unknown());
export type LiveEndpointRequest = z.infer<typeof LiveEndpointRequestSchema>;
