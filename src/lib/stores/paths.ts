import { writable } from 'svelte/store';
import type { ShapeChain } from '../algorithms/chain-detection';
import { workflowStore } from './workflow';

export interface Path {
  id: string;
  name: string;
  operationId: string; // Reference to the operation that created this path
  chainId: string; // Reference to the source chain
  toolId: string | null; // Reference to the tool used
  enabled: boolean;
  order: number; // Execution order within operation
  cutDirection: 'clockwise' | 'counterclockwise' | 'none'; // Detected cut direction
  feedRate?: number; // Cutting speed
  pierceHeight?: number; // Height for pierce operation
  pierceDelay?: number; // Delay for pierce operation
  arcVoltage?: number; // Arc voltage for plasma cutting
  kerfWidth?: number; // Kerf compensation width
  thcEnabled?: boolean; // Torch height control
  leadInLength?: number; // Lead-in length
  leadInType?: 'arc' | 'line' | 'none'; // Lead-in type
  leadOutLength?: number; // Lead-out length
  leadOutType?: 'arc' | 'line' | 'none'; // Lead-out type
  overcutLength?: number; // Overcut length
}

export interface PathsState {
  paths: Path[];
  selectedPathId: string | null;
  highlightedPathId: string | null;
}

// Helper function to check if program stage should be completed
function checkProgramStageCompletion(paths: Path[]) {
  if (paths.length > 0) {
    workflowStore.completeStage('program');
  } else {
    // If no paths exist, invalidate stages after 'prepare'
    workflowStore.invalidateDownstreamStages('prepare');
  }
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
      update(state => {
        const newPaths = [
          ...state.paths,
          {
            ...path,
            id: crypto.randomUUID()
          }
        ];
        
        // Check workflow completion
        setTimeout(() => checkProgramStageCompletion(newPaths), 0);
        
        return {
          ...state,
          paths: newPaths
        };
      });
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
      update(state => {
        const newPaths = state.paths.filter(path => path.id !== id);
        
        // Check workflow completion
        setTimeout(() => checkProgramStageCompletion(newPaths), 0);
        
        return {
          ...state,
          paths: newPaths,
          selectedPathId: state.selectedPathId === id ? null : state.selectedPathId,
          highlightedPathId: state.highlightedPathId === id ? null : state.highlightedPathId
        };
      });
    },
    
    deletePathsByOperation: (operationId: string) => {
      update(state => {
        const newPaths = state.paths.filter(path => path.operationId !== operationId);
        
        // Check workflow completion
        setTimeout(() => checkProgramStageCompletion(newPaths), 0);
        
        return {
          ...state,
          paths: newPaths,
          selectedPathId: state.paths.some(p => p.operationId === operationId && p.id === state.selectedPathId) ? null : state.selectedPathId,
          highlightedPathId: state.paths.some(p => p.operationId === operationId && p.id === state.highlightedPathId) ? null : state.highlightedPathId
        };
      });
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
    
    reset: () => {
      set(initialState);
      // Check workflow completion (will invalidate since no paths)
      setTimeout(() => checkProgramStageCompletion([]), 0);
    }
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