export interface Lab {
  id: string;
  name: string;
  domain: string;
  account:string;
  token:string;
  version: string;
  fieldMappings: FieldMapping[];
  extractionRules: ExtractionRule[];
  sampleFilters: SampleFilter[];
  promptTemplates: PromptTemplate[];
  knowledgeBase: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Project {
  id: string;
  labId: string;
  name: string;
  description?: string;
  status: string;
  documents?: Document[];
  schemas?: Schema[];
  scripts?: Script[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Document {
  id: string;
  projectId: string;
  name: string;
  type: string;
  url?: string;
  content?: Record<string, unknown>;
  annotations: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Schema {
  id: string;
  projectId: string;
  name: string;
  definition: Record<string, unknown>;
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Script {
  id: string;
  projectId: string;
  name: string;
  code: string;
  status: string;
  lastRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LabMember {
  id: string;
  labId: string;
  userId: string;
  role: string;
  createdAt: Date;
}

export interface FieldMapping {
  cellReference: string;
  systemFieldName: string;
  labSpecificRule?: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
}

export interface ExtractionRule {
  name: string;
  pattern: string;
  description?: string;
}

export interface SampleFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
  value: string | number;
}

export interface PromptTemplate {
  name: string;
  template: string;
  description?: string;
  variables: string[];
}
