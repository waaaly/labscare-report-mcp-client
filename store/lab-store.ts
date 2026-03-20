import { create } from 'zustand';
import { Lab, FieldMapping, ExtractionRule, SampleFilter, PromptTemplate } from '@/types';

interface LabState {
  currentLab: Lab | null;
  labs: Lab[];
  isLoading: boolean;
  error: string | null;
  
  setCurrentLab: (lab: Lab | null) => void;
  setLabs: (labs: Lab[]) => void;
  switchLab: (labId: string) => Promise<void>;
  loadLabKnowledgeBase: (labId: string) => Promise<void>;
  updateLabFieldMappings: (mappings: FieldMapping[]) => void;
  updateLabExtractionRules: (rules: ExtractionRule[]) => void;
  updateLabSampleFilters: (filters: SampleFilter[]) => void;
  updateLabPromptTemplates: (templates: PromptTemplate[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useLabStore = create<LabState>((set, get) => ({
  currentLab: null,
  labs: [],
  isLoading: false,
  error: null,

  setCurrentLab: (lab) => set({ currentLab: lab }),

  setLabs: (labs) => set({ labs }),

  switchLab: async (labId) => {
    set({ isLoading: true, error: null });
    try {
      const lab = get().labs.find((l) => l.id === labId);
      if (lab) {
        set({ currentLab: lab });
        await get().loadLabKnowledgeBase(labId);
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to switch lab' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadLabKnowledgeBase: async (labId) => {
    try {
      const response = await fetch(`/api/labs/${labId}/knowledge`);
      if (!response.ok) throw new Error('Failed to load knowledge base');
      const knowledgeBase = await response.json();
      
      set((state) => ({
        currentLab: state.currentLab ? {
          ...state.currentLab,
          knowledgeBase,
        } : null,
      }));
    } catch (error) {
      console.error('Failed to load knowledge base:', error);
    }
  },

  updateLabFieldMappings: (mappings) => {
    set((state) => {
      if (!state.currentLab) {
        return state;
      }
      return {
        ...state,
        currentLab: {
          ...state.currentLab,
          fieldMappings: mappings,
        },
      };
    });
  },

  updateLabExtractionRules: (rules) => {
    set((state) => {
      if (!state.currentLab) {
        return state;
      }
      return {
        ...state,
        currentLab: {
          ...state.currentLab,
          extractionRules: rules,
        },
      };
    });
  },

  updateLabSampleFilters: (filters) => {
    set((state) => {
      if (!state.currentLab) {
        return state;
      }
      return {
        ...state,
        currentLab: {
          ...state.currentLab,
          sampleFilters: filters,
        },
      };
    });
  },

  updateLabPromptTemplates: (templates) => {
    set((state) => {
      if (!state.currentLab) {
        return state;
      }
      return {
        ...state,
        currentLab: {
          ...state.currentLab,
          promptTemplates: templates,
        },
      };
    });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),
}));
