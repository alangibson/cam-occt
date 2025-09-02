import { writable } from 'svelte/store';

export interface UIState {
  showToolTable: boolean;
}

function createUIStore(): {
  subscribe: (run: (value: UIState) => void) => () => void;
  toggleToolTable: () => void;
  showToolTable: () => void;
  hideToolTable: () => void;
} {
  const { subscribe, update } = writable<UIState>({
    showToolTable: false
  });

  return {
    subscribe,
    
    toggleToolTable: () => {
      update(state => ({
        ...state,
        showToolTable: !state.showToolTable
      }));
    },
    
    showToolTable: () => {
      update(state => ({
        ...state,
        showToolTable: true
      }));
    },
    
    hideToolTable: () => {
      update(state => ({
        ...state,
        showToolTable: false
      }));
    }
  };
}

export const uiStore: ReturnType<typeof createUIStore> = createUIStore();