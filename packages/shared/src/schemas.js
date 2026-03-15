'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.LiveEndpointRequestSchema =
  exports.SaveWorkflowSchema =
  exports.WorkflowNodeSchema =
  exports.CreateAgentSchema =
  exports.CreateApiKeySchema =
  exports.FailoverConfigSchema =
  exports.DeployPromptSchema =
  exports.MetricSuggestSchema =
  exports.CreateEvaluationSchema =
  exports.PromptAiConfigSchema =
  exports.UpdateAiProviderSchema =
  exports.CreateAiProviderSchema =
  exports.DatasetVersionCompareSchema =
  exports.UpdateDatasetSchema =
  exports.CreateDatasetSchema =
  exports.PromptDatasetConfigSchema =
  exports.UpdatePromptSchema =
  exports.CreatePromptSchema =
  exports.PromptVariableSchema =
  exports.InviteMemberSchema =
  exports.CreateWorkspaceSchema =
  exports.UpdateOrganizationSchema =
  exports.CreateOrganizationSchema =
  exports.UuidSchema =
  exports.PaginationSchema =
    void 0;
const zod_1 = require('zod');
const constants_js_1 = require('./constants.js');
// ─── Common ───────────────────────────────────────────────────────────────────
exports.PaginationSchema = zod_1.z.object({
  page: zod_1.z.coerce.number().int().min(1).default(1),
  pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(20),
});
exports.UuidSchema = zod_1.z.string().uuid();
// ─── Organizations & Workspaces ───────────────────────────────────────────────
exports.CreateOrganizationSchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(100),
  slug: zod_1.z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});
exports.UpdateOrganizationSchema = exports.CreateOrganizationSchema.partial();
exports.CreateWorkspaceSchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(100),
  slug: zod_1.z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
});
exports.InviteMemberSchema = zod_1.z.object({
  email: zod_1.z.string().email(),
  role: zod_1.z.enum([
    constants_js_1.UserRole.ADMIN,
    constants_js_1.UserRole.DEVELOPER,
    constants_js_1.UserRole.VIEWER,
    constants_js_1.UserRole.API_USER,
  ]),
});
// ─── Prompts ─────────────────────────────────────────────────────────────────
exports.PromptVariableSchema = zod_1.z.object({
  name: zod_1.z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Variable name must be a valid identifier'),
  type: zod_1.z.enum([
    constants_js_1.VariableType.STRING,
    constants_js_1.VariableType.NUMBER,
    constants_js_1.VariableType.BOOLEAN,
    constants_js_1.VariableType.ARRAY,
    constants_js_1.VariableType.OBJECT,
  ]),
  description: zod_1.z.string().max(500).optional(),
  defaultValue: zod_1.z.string().optional(),
});
exports.CreatePromptSchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(255),
  description: zod_1.z.string().max(1000).optional(),
  workspaceId: exports.UuidSchema,
  content: zod_1.z.string().min(1),
  variables: zod_1.z.array(exports.PromptVariableSchema).optional(),
});
exports.UpdatePromptSchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(255).optional(),
  description: zod_1.z.string().max(1000).optional(),
  content: zod_1.z.string().min(1).optional(),
  variables: zod_1.z.array(exports.PromptVariableSchema).optional(),
});
exports.PromptDatasetConfigSchema = zod_1.z.object({
  datasetId: exports.UuidSchema,
  datasetVersionId: exports.UuidSchema,
  variableMapping: zod_1.z.record(zod_1.z.string(), zod_1.z.string()),
});
// ─── Datasets ────────────────────────────────────────────────────────────────
exports.CreateDatasetSchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(255),
  description: zod_1.z.string().max(1000).optional(),
  workspaceId: exports.UuidSchema,
});
exports.UpdateDatasetSchema = exports.CreateDatasetSchema.omit({ workspaceId: true }).partial();
exports.DatasetVersionCompareSchema = zod_1.z.object({
  versionA: zod_1.z.number().int().min(1),
  versionB: zod_1.z.number().int().min(1),
});
// ─── AI Providers ─────────────────────────────────────────────────────────────
exports.CreateAiProviderSchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(255),
  providerType: zod_1.z.enum([
    constants_js_1.ProviderType.OPENAI,
    constants_js_1.ProviderType.TOGETHERAI,
    constants_js_1.ProviderType.MISTRAL,
    constants_js_1.ProviderType.ANTHROPIC,
    constants_js_1.ProviderType.GROQ,
    constants_js_1.ProviderType.OLLAMA,
    constants_js_1.ProviderType.CUSTOM,
  ]),
  apiKey: zod_1.z.string().min(1),
  baseUrl: zod_1.z.string().url().optional(),
  workspaceId: exports.UuidSchema,
});
exports.UpdateAiProviderSchema = exports.CreateAiProviderSchema.omit({
  workspaceId: true,
}).partial();
exports.PromptAiConfigSchema = zod_1.z.object({
  providerId: exports.UuidSchema,
  modelName: zod_1.z.string().min(1),
  temperature: zod_1.z.number().min(0).max(2).default(0.7),
  topP: zod_1.z.number().min(0).max(1).default(1.0),
  topK: zod_1.z.number().int().min(1).default(40),
  maxTokens: zod_1.z.number().int().min(1).max(128000).default(1000),
  repetitionPenalty: zod_1.z.number().min(0).max(2).default(1.0),
  frequencyPenalty: zod_1.z.number().min(0).max(2).optional(),
  stopSequences: zod_1.z.array(zod_1.z.string()).max(4).default([]),
});
// ─── Evaluations ─────────────────────────────────────────────────────────────
exports.CreateEvaluationSchema = zod_1.z.object({
  promptId: exports.UuidSchema,
  promptVersionId: exports.UuidSchema,
  datasetId: exports.UuidSchema,
  datasetVersionId: exports.UuidSchema,
  metrics: zod_1.z.array(zod_1.z.string()).min(1, 'Select at least one metric'),
});
exports.MetricSuggestSchema = zod_1.z.object({
  promptId: exports.UuidSchema,
  promptContent: zod_1.z.string().min(1),
});
// ─── Deployments ─────────────────────────────────────────────────────────────
exports.DeployPromptSchema = zod_1.z.object({
  environment: zod_1.z.enum(['dev', 'staging', 'prod']),
  promptVersionId: exports.UuidSchema,
  providerId: exports.UuidSchema,
  secondaryProviderId: exports.UuidSchema.optional(),
});
exports.FailoverConfigSchema = zod_1.z.object({
  isEnabled: zod_1.z.boolean().default(true),
  timeoutMs: zod_1.z.number().int().min(1000).max(120000).default(30000),
  errorThreshold: zod_1.z.number().int().min(1).max(100).default(3),
  maxLatencyMs: zod_1.z.number().int().min(100).max(60000).default(5000),
  autoRecovery: zod_1.z.boolean().default(true),
  recoveryCheckIntervalMs: zod_1.z.number().int().min(10000).default(300000),
});
// ─── API Keys ─────────────────────────────────────────────────────────────────
exports.CreateApiKeySchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(255),
  scope: zod_1.z.enum(['organization', 'workspace', 'readonly']),
  workspaceId: exports.UuidSchema.optional(),
  orgId: exports.UuidSchema.optional(),
  rateLimitPerMin: zod_1.z.number().int().min(1).max(10000).default(60),
  rateLimitPerDay: zod_1.z.number().int().min(1).max(10000000).default(10000),
  expiresAt: zod_1.z.string().datetime().optional(),
});
// ─── Agents ──────────────────────────────────────────────────────────────────
exports.CreateAgentSchema = zod_1.z.object({
  name: zod_1.z.string().min(1).max(255),
  description: zod_1.z.string().max(1000).optional(),
  workspaceId: exports.UuidSchema,
});
exports.WorkflowNodeSchema = zod_1.z.object({
  id: zod_1.z.string(),
  type: zod_1.z.string(),
  position: zod_1.z.object({ x: zod_1.z.number(), y: zod_1.z.number() }),
  data: zod_1.z.object({
    label: zod_1.z.string(),
    nodeType: zod_1.z.string(),
    config: zod_1.z.record(zod_1.z.unknown()),
  }),
});
exports.SaveWorkflowSchema = zod_1.z.object({
  nodes: zod_1.z.array(exports.WorkflowNodeSchema),
  edges: zod_1.z.array(
    zod_1.z.object({
      id: zod_1.z.string(),
      source: zod_1.z.string(),
      target: zod_1.z.string(),
      sourceHandle: zod_1.z.string().nullable().optional(),
      targetHandle: zod_1.z.string().nullable().optional(),
    }),
  ),
});
// ─── Proxy / Live endpoint ────────────────────────────────────────────────────
exports.LiveEndpointRequestSchema = zod_1.z.object({}).catchall(zod_1.z.unknown());
//# sourceMappingURL=schemas.js.map
