import { writable } from 'svelte/store';
import type { Rapid } from '../algorithms/optimize-cut-order';

export interface RapidsState {
  rapids: Rapid[];
  showRapids: boolean;
  selectedRapidId: string | null;
  highlightedRapidId: string | null;
}

function createRapidsStore() {
  const initialState: RapidsState = {
    rapids: [],
    showRapids: true,
    selectedRapidId: null,
    highlightedRapidId: null
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
    
    selectRapid: (rapidId: string | null) => {
      update(state => ({
        ...state,
        selectedRapidId: rapidId
      }));
    },
    
    highlightRapid: (rapidId: string | null) => {
      update(state => ({
        ...state,
        highlightedRapidId: rapidId
      }));
    },
    
    clearHighlight: () => {
      update(state => ({
        ...state,
        highlightedRapidId: null
      }));
    },
    
    reset: () => set(initialState)
  };
}

export const rapidStore = createRapidsStore();

// Helper functions for rapid selection
export function selectRapid(rapidId: string | null) {
  rapidStore.selectRapid(rapidId);
}

export function highlightRapid(rapidId: string | null) {
  rapidStore.highlightRapid(rapidId);
}

export function clearRapidHighlight() {
  rapidStore.clearHighlight();
}