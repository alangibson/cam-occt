import { writable } from 'svelte/store';

export interface LeadWarning {
  id: string;
  operationId: string;
  chainId: string;
  message: string;
  type: 'lead-in' | 'lead-out';
}

export interface LeadWarningsState {
  warnings: LeadWarning[];
}

const initialState: LeadWarningsState = {
  warnings: []
};

function createLeadWarningsStore() {
  const { subscribe, set, update } = writable<LeadWarningsState>(initialState);

  return {
    subscribe,
    
    addWarning: (warning: Omit<LeadWarning, 'id'>) => {
      update(state => ({
        ...state,
        warnings: [...state.warnings, {
          ...warning,
          id: crypto.randomUUID()
        }]
      }));
    },
    
    clearWarningsForOperation: (operationId: string) => {
      update(state => ({
        ...state,
        warnings: state.warnings.filter(w => w.operationId !== operationId)
      }));
    },
    
    clearWarningsForChain: (chainId: string) => {
      update(state => ({
        ...state,
        warnings: state.warnings.filter(w => w.chainId !== chainId)
      }));
    },
    
    clearAllWarnings: () => {
      set(initialState);
    },
    
    getWarningsForOperation: (operationId: string): LeadWarning[] => {
      let warnings: LeadWarning[] = [];
      const unsubscribe = subscribe(state => {
        warnings = state.warnings.filter(w => w.operationId === operationId);
      });
      unsubscribe();
      return warnings;
    }
  };
}

export const leadWarningsStore = createLeadWarningsStore();