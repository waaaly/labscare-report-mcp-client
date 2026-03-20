export interface CreateLabRequest {
  name: string;
  domain?: string;
  fieldMappings?: Record<string, unknown>;
  extractionRules?: Record<string, unknown>;
  sampleFilters?: Record<string, unknown>;
  promptTemplates?: Record<string, unknown>;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
}

export interface UpdateKnowledgeBaseRequest {
  knowledgeBase: Record<string, unknown>;
}
