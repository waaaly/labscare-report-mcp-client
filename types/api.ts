export interface CreateLabRequest {
  name: string;
  domain?: string;
  fieldMappings?: Record<string, unknown>;
  extractionRules?: Record<string, unknown>;
  sampleFilters?: Record<string, unknown>;
  promptTemplates?: Record<string, unknown>;
}

export interface UpdateLabRequest {
  id: string;
  name?: string;
  domain?: string;
  version?: string;
  account?: string;
  token?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  limsPid: string;
  caseId?: string;
}

export interface UpdateKnowledgeBaseRequest {
  knowledgeBase: Record<string, unknown>;
}
