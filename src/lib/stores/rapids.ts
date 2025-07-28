import { writable } from 'svelte/store';
import type { Rapid } from '../algorithms/optimize-cut-order';

export interface RapidsState {
  rapids: Rapid[];
  showRapids: boolean;
}

function createRapidsStore() {
  const initialState: RapidsState = {
    rapids: [],
    showRapids: true
  };

  const { subscribe, set, update } = writable<RapidsState>(initialState);

  return {
    subscribe,
    
    setRapids: (rapids: Rapid[]) => {
      update(state => ({
        ...state,
        rapids
      }));
    },
    
    clearRapids: () => {
      update(state => ({
        ...state,
        rapids: []
      }));
    },
    
    toggleShowRapids: () => {
      update(state => ({
        ...state,
        showRapids: !state.showRapids
      }));
    },
    
    setShowRapids: (show: boolean) => {
      update(state => ({
        ...state,
        showRapids: show
      }));
    },
    
    reset: () => set(initialState)
  };
}

export const rapidStore = createRapidsStore();