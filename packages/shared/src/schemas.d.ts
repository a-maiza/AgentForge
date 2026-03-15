import { z } from 'zod';
export declare const PaginationSchema: z.ZodObject<
  {
    page: z.ZodDefault<z.ZodNumber>;
    pageSize: z.ZodDefault<z.ZodNumber>;
  },
  'strip',
  z.ZodTypeAny,
  {
    page: number;
    pageSize: number;
  },
  {
    page?: number | undefined;
    pageSize?: number | undefined;
  }
>;
export declare const UuidSchema: z.ZodString;
export declare const CreateOrganizationSchema: z.ZodObject<
  {
    name: z.ZodString;
    slug: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    slug: string;
  },
  {
    name: string;
    slug: string;
  }
>;
export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export declare const UpdateOrganizationSchema: z.ZodObject<
  {
    name: z.ZodOptional<z.ZodString>;
    slug: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    name?: string | undefined;
    slug?: string | undefined;
  },
  {
    name?: string | undefined;
    slug?: string | undefined;
  }
>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
export declare const CreateWorkspaceSchema: z.ZodObject<
  {
    name: z.ZodString;
    slug: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    slug: string;
  },
  {
    name: string;
    slug: string;
  }
>;
export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export declare const InviteMemberSchema: z.ZodObject<
  {
    email: z.ZodString;
    role: z.ZodEnum<['admin', 'developer', 'viewer', 'api_user']>;
  },
  'strip',
  z.ZodTypeAny,
  {
    email: string;
    role: 'admin' | 'developer' | 'viewer' | 'api_user';
  },
  {
    email: string;
    role: 'admin' | 'developer' | 'viewer' | 'api_user';
  }
>;
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>;
export declare const PromptVariableSchema: z.ZodObject<
  {
    name: z.ZodString;
    type: z.ZodEnum<['string', 'number', 'boolean', 'array', 'object']>;
    description: z.ZodOptional<z.ZodString>;
    defaultValue: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string | undefined;
    defaultValue?: string | undefined;
  },
  {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string | undefined;
    defaultValue?: string | undefined;
  }
>;
export declare const CreatePromptSchema: z.ZodObject<
  {
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodString;
    content: z.ZodString;
    variables: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            name: z.ZodString;
            type: z.ZodEnum<['string', 'number', 'boolean', 'array', 'object']>;
            description: z.ZodOptional<z.ZodString>;
            defaultValue: z.ZodOptional<z.ZodString>;
          },
          'strip',
          z.ZodTypeAny,
          {
            name: string;
            type: 'string' | 'number' | 'boolean' | 'object' | 'array';
            description?: string | undefined;
            defaultValue?: string | undefined;
          },
          {
            name: string;
            type: 'string' | 'number' | 'boolean' | 'object' | 'array';
            description?: string | undefined;
            defaultValue?: string | undefined;
          }
        >,
        'many'
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    workspaceId: string;
    content: string;
    description?: string | undefined;
    variables?:
      | {
          name: string;
          type: 'string' | 'number' | 'boolean' | 'object' | 'array';
          description?: string | undefined;
          defaultValue?: string | undefined;
        }[]
      | undefined;
  },
  {
    name: string;
    workspaceId: string;
    content: string;
    description?: string | undefined;
    variables?:
      | {
          name: string;
          type: 'string' | 'number' | 'boolean' | 'object' | 'array';
          description?: string | undefined;
          defaultValue?: string | undefined;
        }[]
      | undefined;
  }
>;
export type CreatePromptInput = z.infer<typeof CreatePromptSchema>;
export declare const UpdatePromptSchema: z.ZodObject<
  {
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    content: z.ZodOptional<z.ZodString>;
    variables: z.ZodOptional<
      z.ZodArray<
        z.ZodObject<
          {
            name: z.ZodString;
            type: z.ZodEnum<['string', 'number', 'boolean', 'array', 'object']>;
            description: z.ZodOptional<z.ZodString>;
            defaultValue: z.ZodOptional<z.ZodString>;
          },
          'strip',
          z.ZodTypeAny,
          {
            name: string;
            type: 'string' | 'number' | 'boolean' | 'object' | 'array';
            description?: string | undefined;
            defaultValue?: string | undefined;
          },
          {
            name: string;
            type: 'string' | 'number' | 'boolean' | 'object' | 'array';
            description?: string | undefined;
            defaultValue?: string | undefined;
          }
        >,
        'many'
      >
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    name?: string | undefined;
    description?: string | undefined;
    variables?:
      | {
          name: string;
          type: 'string' | 'number' | 'boolean' | 'object' | 'array';
          description?: string | undefined;
          defaultValue?: string | undefined;
        }[]
      | undefined;
    content?: string | undefined;
  },
  {
    name?: string | undefined;
    description?: string | undefined;
    variables?:
      | {
          name: string;
          type: 'string' | 'number' | 'boolean' | 'object' | 'array';
          description?: string | undefined;
          defaultValue?: string | undefined;
        }[]
      | undefined;
    content?: string | undefined;
  }
>;
export type UpdatePromptInput = z.infer<typeof UpdatePromptSchema>;
export declare const PromptDatasetConfigSchema: z.ZodObject<
  {
    datasetId: z.ZodString;
    datasetVersionId: z.ZodString;
    variableMapping: z.ZodRecord<z.ZodString, z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    datasetId: string;
    datasetVersionId: string;
    variableMapping: Record<string, string>;
  },
  {
    datasetId: string;
    datasetVersionId: string;
    variableMapping: Record<string, string>;
  }
>;
export type PromptDatasetConfigInput = z.infer<typeof PromptDatasetConfigSchema>;
export declare const CreateDatasetSchema: z.ZodObject<
  {
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    workspaceId: string;
    description?: string | undefined;
  },
  {
    name: string;
    workspaceId: string;
    description?: string | undefined;
  }
>;
export type CreateDatasetInput = z.infer<typeof CreateDatasetSchema>;
export declare const UpdateDatasetSchema: z.ZodObject<
  {
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodOptional<z.ZodString>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    name?: string | undefined;
    description?: string | undefined;
  },
  {
    name?: string | undefined;
    description?: string | undefined;
  }
>;
export type UpdateDatasetInput = z.infer<typeof UpdateDatasetSchema>;
export declare const DatasetVersionCompareSchema: z.ZodObject<
  {
    versionA: z.ZodNumber;
    versionB: z.ZodNumber;
  },
  'strip',
  z.ZodTypeAny,
  {
    versionA: number;
    versionB: number;
  },
  {
    versionA: number;
    versionB: number;
  }
>;
export type DatasetVersionCompareInput = z.infer<typeof DatasetVersionCompareSchema>;
export declare const CreateAiProviderSchema: z.ZodObject<
  {
    name: z.ZodString;
    providerType: z.ZodEnum<
      ['openai', 'togetherai', 'mistral', 'anthropic', 'groq', 'ollama', 'custom']
    >;
    apiKey: z.ZodString;
    baseUrl: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    workspaceId: string;
    providerType: 'openai' | 'togetherai' | 'mistral' | 'anthropic' | 'groq' | 'ollama' | 'custom';
    apiKey: string;
    baseUrl?: string | undefined;
  },
  {
    name: string;
    workspaceId: string;
    providerType: 'openai' | 'togetherai' | 'mistral' | 'anthropic' | 'groq' | 'ollama' | 'custom';
    apiKey: string;
    baseUrl?: string | undefined;
  }
>;
export type CreateAiProviderInput = z.infer<typeof CreateAiProviderSchema>;
export declare const UpdateAiProviderSchema: z.ZodObject<
  {
    name: z.ZodOptional<z.ZodString>;
    providerType: z.ZodOptional<
      z.ZodEnum<['openai', 'togetherai', 'mistral', 'anthropic', 'groq', 'ollama', 'custom']>
    >;
    apiKey: z.ZodOptional<z.ZodString>;
    baseUrl: z.ZodOptional<z.ZodOptional<z.ZodString>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    name?: string | undefined;
    providerType?:
      | 'openai'
      | 'togetherai'
      | 'mistral'
      | 'anthropic'
      | 'groq'
      | 'ollama'
      | 'custom'
      | undefined;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
  },
  {
    name?: string | undefined;
    providerType?:
      | 'openai'
      | 'togetherai'
      | 'mistral'
      | 'anthropic'
      | 'groq'
      | 'ollama'
      | 'custom'
      | undefined;
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
  }
>;
export type UpdateAiProviderInput = z.infer<typeof UpdateAiProviderSchema>;
export declare const PromptAiConfigSchema: z.ZodObject<
  {
    providerId: z.ZodString;
    modelName: z.ZodString;
    temperature: z.ZodDefault<z.ZodNumber>;
    topP: z.ZodDefault<z.ZodNumber>;
    topK: z.ZodDefault<z.ZodNumber>;
    maxTokens: z.ZodDefault<z.ZodNumber>;
    repetitionPenalty: z.ZodDefault<z.ZodNumber>;
    frequencyPenalty: z.ZodOptional<z.ZodNumber>;
    stopSequences: z.ZodDefault<z.ZodArray<z.ZodString, 'many'>>;
  },
  'strip',
  z.ZodTypeAny,
  {
    providerId: string;
    modelName: string;
    temperature: number;
    topP: number;
    topK: number;
    maxTokens: number;
    repetitionPenalty: number;
    stopSequences: string[];
    frequencyPenalty?: number | undefined;
  },
  {
    providerId: string;
    modelName: string;
    temperature?: number | undefined;
    topP?: number | undefined;
    topK?: number | undefined;
    maxTokens?: number | undefined;
    repetitionPenalty?: number | undefined;
    frequencyPenalty?: number | undefined;
    stopSequences?: string[] | undefined;
  }
>;
export type PromptAiConfigInput = z.infer<typeof PromptAiConfigSchema>;
export declare const CreateEvaluationSchema: z.ZodObject<
  {
    promptId: z.ZodString;
    promptVersionId: z.ZodString;
    datasetId: z.ZodString;
    datasetVersionId: z.ZodString;
    metrics: z.ZodArray<z.ZodString, 'many'>;
  },
  'strip',
  z.ZodTypeAny,
  {
    datasetId: string;
    datasetVersionId: string;
    promptId: string;
    promptVersionId: string;
    metrics: string[];
  },
  {
    datasetId: string;
    datasetVersionId: string;
    promptId: string;
    promptVersionId: string;
    metrics: string[];
  }
>;
export type CreateEvaluationInput = z.infer<typeof CreateEvaluationSchema>;
export declare const MetricSuggestSchema: z.ZodObject<
  {
    promptId: z.ZodString;
    promptContent: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    promptId: string;
    promptContent: string;
  },
  {
    promptId: string;
    promptContent: string;
  }
>;
export type MetricSuggestInput = z.infer<typeof MetricSuggestSchema>;
export declare const DeployPromptSchema: z.ZodObject<
  {
    environment: z.ZodEnum<['dev', 'staging', 'prod']>;
    promptVersionId: z.ZodString;
    providerId: z.ZodString;
    secondaryProviderId: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    providerId: string;
    promptVersionId: string;
    environment: 'dev' | 'staging' | 'prod';
    secondaryProviderId?: string | undefined;
  },
  {
    providerId: string;
    promptVersionId: string;
    environment: 'dev' | 'staging' | 'prod';
    secondaryProviderId?: string | undefined;
  }
>;
export type DeployPromptInput = z.infer<typeof DeployPromptSchema>;
export declare const FailoverConfigSchema: z.ZodObject<
  {
    isEnabled: z.ZodDefault<z.ZodBoolean>;
    timeoutMs: z.ZodDefault<z.ZodNumber>;
    errorThreshold: z.ZodDefault<z.ZodNumber>;
    maxLatencyMs: z.ZodDefault<z.ZodNumber>;
    autoRecovery: z.ZodDefault<z.ZodBoolean>;
    recoveryCheckIntervalMs: z.ZodDefault<z.ZodNumber>;
  },
  'strip',
  z.ZodTypeAny,
  {
    isEnabled: boolean;
    timeoutMs: number;
    errorThreshold: number;
    maxLatencyMs: number;
    autoRecovery: boolean;
    recoveryCheckIntervalMs: number;
  },
  {
    isEnabled?: boolean | undefined;
    timeoutMs?: number | undefined;
    errorThreshold?: number | undefined;
    maxLatencyMs?: number | undefined;
    autoRecovery?: boolean | undefined;
    recoveryCheckIntervalMs?: number | undefined;
  }
>;
export type FailoverConfigInput = z.infer<typeof FailoverConfigSchema>;
export declare const CreateApiKeySchema: z.ZodObject<
  {
    name: z.ZodString;
    scope: z.ZodEnum<['organization', 'workspace', 'readonly']>;
    workspaceId: z.ZodOptional<z.ZodString>;
    orgId: z.ZodOptional<z.ZodString>;
    rateLimitPerMin: z.ZodDefault<z.ZodNumber>;
    rateLimitPerDay: z.ZodDefault<z.ZodNumber>;
    expiresAt: z.ZodOptional<z.ZodString>;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    scope: 'organization' | 'workspace' | 'readonly';
    rateLimitPerMin: number;
    rateLimitPerDay: number;
    workspaceId?: string | undefined;
    orgId?: string | undefined;
    expiresAt?: string | undefined;
  },
  {
    name: string;
    scope: 'organization' | 'workspace' | 'readonly';
    workspaceId?: string | undefined;
    orgId?: string | undefined;
    rateLimitPerMin?: number | undefined;
    rateLimitPerDay?: number | undefined;
    expiresAt?: string | undefined;
  }
>;
export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
export declare const CreateAgentSchema: z.ZodObject<
  {
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    workspaceId: z.ZodString;
  },
  'strip',
  z.ZodTypeAny,
  {
    name: string;
    workspaceId: string;
    description?: string | undefined;
  },
  {
    name: string;
    workspaceId: string;
    description?: string | undefined;
  }
>;
export type CreateAgentInput = z.infer<typeof CreateAgentSchema>;
export declare const WorkflowNodeSchema: z.ZodType<{
  id: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    nodeType: string;
    config: Record<string, unknown>;
  };
}>;
export declare const SaveWorkflowSchema: z.ZodObject<
  {
    nodes: z.ZodArray<
      z.ZodType<
        {
          id: string;
          type: string;
          position: {
            x: number;
            y: number;
          };
          data: {
            label: string;
            nodeType: string;
            config: Record<string, unknown>;
          };
        },
        z.ZodTypeDef,
        {
          id: string;
          type: string;
          position: {
            x: number;
            y: number;
          };
          data: {
            label: string;
            nodeType: string;
            config: Record<string, unknown>;
          };
        }
      >,
      'many'
    >;
    edges: z.ZodArray<
      z.ZodObject<
        {
          id: z.ZodString;
          source: z.ZodString;
          target: z.ZodString;
          sourceHandle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
          targetHandle: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        },
        'strip',
        z.ZodTypeAny,
        {
          target: string;
          id: string;
          source: string;
          sourceHandle?: string | null | undefined;
          targetHandle?: string | null | undefined;
        },
        {
          target: string;
          id: string;
          source: string;
          sourceHandle?: string | null | undefined;
          targetHandle?: string | null | undefined;
        }
      >,
      'many'
    >;
  },
  'strip',
  z.ZodTypeAny,
  {
    nodes: {
      id: string;
      type: string;
      position: {
        x: number;
        y: number;
      };
      data: {
        label: string;
        nodeType: string;
        config: Record<string, unknown>;
      };
    }[];
    edges: {
      target: string;
      id: string;
      source: string;
      sourceHandle?: string | null | undefined;
      targetHandle?: string | null | undefined;
    }[];
  },
  {
    nodes: {
      id: string;
      type: string;
      position: {
        x: number;
        y: number;
      };
      data: {
        label: string;
        nodeType: string;
        config: Record<string, unknown>;
      };
    }[];
    edges: {
      target: string;
      id: string;
      source: string;
      sourceHandle?: string | null | undefined;
      targetHandle?: string | null | undefined;
    }[];
  }
>;
export type SaveWorkflowInput = z.infer<typeof SaveWorkflowSchema>;
export declare const LiveEndpointRequestSchema: z.ZodObject<
  {},
  'strip',
  z.ZodUnknown,
  z.objectOutputType<{}, z.ZodUnknown, 'strip'>,
  z.objectInputType<{}, z.ZodUnknown, 'strip'>
>;
export type LiveEndpointRequest = z.infer<typeof LiveEndpointRequestSchema>;
//# sourceMappingURL=schemas.d.ts.map
