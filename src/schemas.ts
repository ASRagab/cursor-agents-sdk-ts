import { z } from "zod";

export const ImageDimensionSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type ImageDimension = z.infer<typeof ImageDimensionSchema>;

export const ImageSchema = z.object({
  data: z.string().min(1),
  dimension: ImageDimensionSchema.optional(),
});
export type Image = z.infer<typeof ImageSchema>;

export const PromptSchema = z.object({
  text: z.string().min(1),
  images: z.array(ImageSchema).max(5).optional(),
});
export type Prompt = z.infer<typeof PromptSchema>;

export const AgentStatusSchema = z.enum(["CREATING", "RUNNING", "FINISHED", "ERROR", "EXPIRED"]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const SourceSchema = z.object({
  repository: z.string(),
  ref: z.string().optional(),
  prUrl: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

export const TargetSchema = z.object({
  autoCreatePr: z.boolean().optional(),
  openAsCursorGithubApp: z.boolean().optional(),
  skipReviewerRequest: z.boolean().optional(),
  branchName: z.string().optional(),
  autoBranch: z.boolean().optional(),
  url: z.string().optional(),
  prUrl: z.string().optional(),
});
export type Target = z.infer<typeof TargetSchema>;

export const WebhookSchema = z.object({
  url: z.string(),
  secret: z.string().min(32).optional(),
});
export type Webhook = z.infer<typeof WebhookSchema>;

export const AgentSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  status: AgentStatusSchema,
  source: SourceSchema,
  target: TargetSchema.optional(),
  summary: z.string().optional(),
  filesChanged: z.number().optional(),
  linesAdded: z.number().optional(),
  linesRemoved: z.number().optional(),
  createdAt: z.string(),
});
export type Agent = z.infer<typeof AgentSchema>;

export const CreateAgentRequestSchema = z.object({
  prompt: PromptSchema,
  source: z.union([
    z.object({ repository: z.string(), ref: z.string().optional() }),
    z.object({ prUrl: z.string() }),
  ]),
  model: z.string().optional(),
  target: TargetSchema.optional(),
  webhook: WebhookSchema.optional(),
});
export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>;

export const CreateAgentResponseSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  status: AgentStatusSchema,
  source: SourceSchema,
  target: TargetSchema.optional(),
  createdAt: z.string(),
});
export type CreateAgentResponse = z.infer<typeof CreateAgentResponseSchema>;

export const ListAgentsResponseSchema = z.object({
  agents: z.array(AgentSchema),
  nextCursor: z.string().optional(),
});
export type ListAgentsResponse = z.infer<typeof ListAgentsResponseSchema>;

export const ConversationMessageSchema = z.object({
  id: z.string(),
  type: z.enum(["user_message", "assistant_message"]),
  text: z.string(),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationSchema = z.object({
  id: z.string(),
  messages: z.array(ConversationMessageSchema),
});
export type Conversation = z.infer<typeof ConversationSchema>;

export const ArtifactSchema = z.object({
  absolutePath: z.string(),
  sizeBytes: z.number(),
  updatedAt: z.string(),
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const ListArtifactsResponseSchema = z.object({
  artifacts: z.array(ArtifactSchema),
});
export type ListArtifactsResponse = z.infer<typeof ListArtifactsResponseSchema>;

export const DownloadArtifactResponseSchema = z.object({
  url: z.string(),
  expiresAt: z.string(),
});
export type DownloadArtifactResponse = z.infer<typeof DownloadArtifactResponseSchema>;

export const MeResponseSchema = z.object({
  apiKeyName: z.string(),
  createdAt: z.string(),
  userEmail: z.string().optional(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

export const ModelsResponseSchema = z.object({
  models: z.array(z.string()),
});
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>;

export const RepositorySchema = z.object({
  owner: z.string(),
  name: z.string(),
  repository: z.string(),
});
export type Repository = z.infer<typeof RepositorySchema>;

export const RepositoriesResponseSchema = z.object({
  repositories: z.array(RepositorySchema),
});
export type RepositoriesResponse = z.infer<typeof RepositoriesResponseSchema>;

export const ErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export const IdResponseSchema = z.object({
  id: z.string(),
});
export type IdResponse = z.infer<typeof IdResponseSchema>;
