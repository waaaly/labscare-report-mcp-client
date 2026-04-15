import { create } from 'zustand';

interface ScriptState {
  scripts: Script[];
  currentScript: Script | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };

  setScripts: (scripts: Script[]) => void;
  setCurrentScript: (script: Script | null) => void;
  addScript: (script: Script) => void;
  updateScript: (id: string, updates: Partial<Script>) => void;
  deleteScript: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setPagination: (pagination: Partial<ScriptState['pagination']>) => void;
  loadScripts: (labId: string, params?: LoadScriptsParams) => Promise<void>;
  loadScript: (labId: string, scriptId: string) => Promise<void>;
}

interface LoadScriptsParams {
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
  pageSize?: number;
  projectId?: string;
  reportId?: string;
}

interface Script {
  id: string;
  name: string;
  projectName: string | null;
  reportName: string | null;
  taskName: string | null;
  createdAt: string;
  updatedAt?: string;
  code?: string;
  version?: number;
  projectId?: string;
  reportId?: string;
  taskId?: string;
  taskStatus?: string;
  taskModel?: string;
  dataSourceId?: string;
  dataSourceName?: string;
  dataSourceType?: string;
  dataSourceUrl?: string;
  project?: {
    id: string;
    name: string;
    limsPid: string;
    createdAt: string;
  };
  report?: {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
  };
  task?: {
    id: string;
    status: string;
    model: string;
    progress: number;
    duration: number | null;
    createdAt: string;
    completedAt: string | null;
  };
  dataSource?: {
    id: string;
    name: string;
    type: string;
    url: string;
    size: bigint | number;
    status: string;
    storagePath: string | null;
    pdf: string | null;
    cover: string | null;
    createdAt: string;
  };
}

export const useScriptStore = create<ScriptState>((set, get) => ({
  scripts: [],
  currentScript: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 1
  },

  setScripts: (scripts) => set({ scripts }),

  setCurrentScript: (script) => set({ currentScript: script }),

  addScript: (script) => set((state) => ({ scripts: [...state.scripts, script] })),

  updateScript: (id, updates) =>
    set((state) => ({
      scripts: state.scripts.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      currentScript: state.currentScript?.id === id
        ? { ...state.currentScript, ...updates }
        : state.currentScript
    })),

  deleteScript: (id) =>
    set((state) => ({
      scripts: state.scripts.filter((s) => s.id !== id),
      currentScript: state.currentScript?.id === id ? null : state.currentScript
    })),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  setPagination: (pagination) =>
    set((state) => ({ pagination: { ...state.pagination, ...pagination } })),

  loadScripts: async (labId, params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const {
        search = '',
        sortBy = 'createdAt',
        sortOrder = 'desc',
        page = 1,
        pageSize = 10,
        projectId,
        reportId
      } = params;

      const queryParams = new URLSearchParams({
        search,
        sortBy,
        sortOrder,
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      if (projectId) queryParams.set('projectId', projectId);
      if (reportId) queryParams.set('reportId', reportId);

      const response = await fetch(`/api/labs/${labId}/scripts?${queryParams}`);
      if (!response.ok) throw new Error('Failed to load scripts');

      const data = await response.json();
      set({
        scripts: data.scripts,
        pagination: data.pagination
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load scripts' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadScript: async (labId, scriptId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/labs/${labId}/scripts/${scriptId}`);
      if (!response.ok) throw new Error('Failed to load script');

      const data = await response.json();
      set({ currentScript: data.script });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load script' });
    } finally {
      set({ isLoading: false });
    }
  }
}));