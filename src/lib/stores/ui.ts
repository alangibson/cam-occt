import { writable } from 'svelte/store';

export interface UIState {
  showToolTable: boolean;
}

function createUIStore() {
  const { subscribe, set, update } = writable<UIState>({
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

export const uiStore = createUIStore();