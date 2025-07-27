import { writable } from 'svelte/store';
import type { ShapeChain } from '../algorithms/chain-detection';

export interface Path {
  id: string;
  name: string;
  operationId: string; // Reference to the operation that created this path
  chainId: string; // Reference to the source chain
  toolId: string | null; // Reference to the tool used
  enabled: boolean;
  order: number; // Execution order within operation
  feedRate?: number; // Cutting speed
  pierceHeight?: number; // Height for pierce operation
  pierceDelay?: number; // Delay for pierce operation
  arcVoltage?: number; // Arc voltage for plasma cutting
  kerfWidth?: number; // Kerf compensation width
  thcEnabled?: boolean; // Torch height control
  leadInLength?: number; // Lead-in length
  leadOutLength?: number; // Lead-out length
  overcutLength?: number; // Overcut length
}

export interface PathsState {
  paths: Path[];
  selectedPathId: string | null;
  highlightedPathId: string | null;
}

function createPathsStore() {
  const initialState: PathsState = {
    paths: [],
    selectedPathId: null,
    highlightedPathId: null
  };

  const { subscribe, set, update } = writable<PathsState>(initialState);

  return {
    subscribe,
    
    addPath: (path: Omit<Path, 'id'>) => {
      update(state => ({
        ...state,
        paths: [
          ...state.paths,
          {
            ...path,
            id: crypto.randomUUID()
          }
        ]
      }));
    },
    
    updatePath: (id: string, updates: Partial<Path>) => {
      update(state => ({
        ...state,
        paths: state.paths.map(path => 
          path.id === id ? { ...path, ...updates } : path
        )
      }));
    },
    
    deletePath: (id: string) => {
      update(state => ({
        ...state,
        paths: state.paths.filter(path => path.id !== id),
        selectedPathId: state.selectedPathId === id ? null : state.selectedPathId,
        highlightedPathId: state.highlightedPathId === id ? null : state.highlightedPathId
      }));
    },
    
    deletePathsByOperation: (operationId: string) => {
      update(state => ({
        ...state,
        paths: state.paths.filter(path => path.operationId !== operationId),
        selectedPathId: state.paths.some(p => p.operationId === operationId && p.id === state.selectedPathId) ? null : state.selectedPathId,
        highlightedPathId: state.paths.some(p => p.operationId === operationId && p.id === state.highlightedPathId) ? null : state.highlightedPathId
      }));
    },
    
    selectPath: (pathId: string | null) => {
      update(state => ({
        ...state,
        selectedPathId: pathId
      }));
    },
    
    highlightPath: (pathId: string | null) => {
      update(state => ({
        ...state,
        highlightedPathId: pathId
      }));
    },
    
    clearHighlight: () => {
      update(state => ({
        ...state,
        highlightedPathId: null
      }));
    },
    
    reorderPaths: (newPaths: Path[]) => {
      update(state => ({
        ...state,
        paths: newPaths
      }));
    },
    
    getPathsByChain: (chainId: string) => {
      let currentPaths: Path[] = [];
      const unsubscribe = subscribe(state => {
        currentPaths = state.paths.filter(path => path.chainId === chainId);
      });
      unsubscribe();
      return currentPaths;
    },
    
    getChainsWithPaths: () => {
      let chainIds: string[] = [];
      const unsubscribe = subscribe(state => {
        chainIds = [...new Set(state.paths.map(path => path.chainId))];
      });
      unsubscribe();
      return chainIds;
    },
    
    reset: () => set(initialState)
  };
}

export const pathStore = createPathsStore();

// Helper functions for path selection
export function selectPath(pathId: string | null) {
  pathStore.selectPath(pathId);
}

export function highlightPath(pathId: string | null) {
  pathStore.highlightPath(pathId);
}

export function clearPathHighlight() {
  pathStore.clearHighlight();
}