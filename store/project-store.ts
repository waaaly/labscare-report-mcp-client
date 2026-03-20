import { create } from 'zustand';
import { Project, Document, Schema, Script } from '@/types';

interface ProjectState {
  currentProject: Project | null;
  projects: Project[];
  documents: Document[];
  schemas: Schema[];
  scripts: Script[];
  isLoading: boolean;
  error: string | null;
  
  setCurrentProject: (project: Project | null) => void;
  setProjects: (projects: Project[]) => void;
  setDocuments: (documents: Document[]) => void;
  setSchemas: (schemas: Schema[]) => void;
  setScripts: (scripts: Script[]) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addDocument: (document: Document) => void;
  updateDocument: (id: string, updates: Partial<Document>) => void;
  deleteDocument: (id: string) => void;
  addSchema: (schema: Schema) => void;
  updateSchema: (id: string, updates: Partial<Schema>) => void;
  deleteSchema: (id: string) => void;
  addScript: (script: Script) => void;
  updateScript: (id: string, updates: Partial<Script>) => void;
  deleteScript: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadProjects: (labId: string) => Promise<void>;
  loadProject: (projectId: string, labId: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: null,
  projects: [],
  documents: [],
  schemas: [],
  scripts: [],
  isLoading: false,
  error: null,

  setCurrentProject: (project) => set({ currentProject: project }),

  setProjects: (projects) => set({ projects }),

  setDocuments: (documents) => set({ documents }),

  setSchemas: (schemas) => set({ schemas }),

  setScripts: (scripts) => set({ scripts }),

  addProject: (project) => set((state) => ({ projects: [...state.projects, project] })),

  updateProject: (id, updates) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      currentProject: state.currentProject?.id === id
        ? { ...state.currentProject, ...updates }
        : state.currentProject,
    })),

  deleteProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
    })),

  addDocument: (document) => set((state) => ({ documents: [...state.documents, document] })),

  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),

  deleteDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
    })),

  addSchema: (schema) => set((state) => ({ schemas: [...state.schemas, schema] })),

  updateSchema: (id, updates) =>
    set((state) => ({
      schemas: state.schemas.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  deleteSchema: (id) =>
    set((state) => ({
      schemas: state.schemas.filter((s) => s.id !== id),
    })),

  addScript: (script) => set((state) => ({ scripts: [...state.scripts, script] })),

  updateScript: (id, updates) =>
    set((state) => ({
      scripts: state.scripts.map((s) => (s.id === id ? { ...s, ...updates } : s)),
    })),

  deleteScript: (id) =>
    set((state) => ({
      scripts: state.scripts.filter((s) => s.id !== id),
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  loadProjects: async (labId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/labs/${labId}/projects`);
      if (!response.ok) throw new Error('Failed to load projects');
      const projects = await response.json();
      set({ projects });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load projects' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadProject: async (projectId, labId) => {
    set({ isLoading: true, error: null });
    try {
      if (!labId) {
        throw new Error('labId is required');
      }
      const response = await fetch(`/api/labs/${labId}/projects`);
      if (!response.ok) throw new Error('Failed to load projects');
      const projects = await response.json();
      const project = projects.find((p: Project) => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      set({ currentProject: project, documents: project.documents || [], schemas: project.schemas || [], scripts: project.scripts || [] });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load project' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
