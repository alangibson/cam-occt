/**
 * Workflow state management for CAM-OCCT application
 * Manages the 6-stage workflow: Import → Edit → Prepare → Program → Simulate → Export
 */

import { writable, type Writable } from 'svelte/store';

export type WorkflowStage = 'import' | 'edit' | 'prepare' | 'program' | 'simulate' | 'export';

export interface WorkflowState {
  currentStage: WorkflowStage;
  completedStages: Set<WorkflowStage>;
  canAdvanceTo: (stage: WorkflowStage) => boolean;
}

// Define the workflow progression order
const WORKFLOW_ORDER: WorkflowStage[] = ['import', 'edit', 'prepare', 'program', 'simulate', 'export'];

function createWorkflowStore(): Writable<WorkflowState> & {
  setStage: (stage: WorkflowStage) => void;
  completeStage: (stage: WorkflowStage) => void;
  canAdvanceTo: (stage: WorkflowStage) => boolean;
  getNextStage: () => WorkflowStage | null;
  getPreviousStage: () => WorkflowStage | null;
  reset: () => void;
} {
  const initialState: WorkflowState = {
    currentStage: 'import',
    completedStages: new Set(),
    canAdvanceTo: (stage: WorkflowStage) => {
      const currentIndex = WORKFLOW_ORDER.indexOf(stage);
      const completedUpTo = Math.max(
        -1,
        ...Array.from(initialState.completedStages).map(s => WORKFLOW_ORDER.indexOf(s))
      );
      return currentIndex <= completedUpTo + 1;
    }
  };

  const { subscribe, set, update } = writable<WorkflowState>(initialState);

  return {
    subscribe,
    set,
    update,

    setStage: (stage: WorkflowStage) => {
      update(state => {
        if (state.canAdvanceTo(stage)) {
          return { ...state, currentStage: stage };
        }
        return state;
      });
    },

    completeStage: (stage: WorkflowStage) => {
      update(state => {
        const newCompleted = new Set(state.completedStages);
        newCompleted.add(stage);
        
        return {
          ...state,
          completedStages: newCompleted,
          canAdvanceTo: (targetStage: WorkflowStage) => {
            const targetIndex = WORKFLOW_ORDER.indexOf(targetStage);
            const completedUpTo = Math.max(
              -1,
              ...Array.from(newCompleted).map(s => WORKFLOW_ORDER.indexOf(s))
            );
            return targetIndex <= completedUpTo + 1;
          }
        };
      });
    },

    canAdvanceTo: (stage: WorkflowStage) => {
      let canAdvance = false;
      update(state => {
        canAdvance = state.canAdvanceTo(stage);
        return state;
      });
      return canAdvance;
    },

    getNextStage: () => {
      let nextStage: WorkflowStage | null = null;
      update(state => {
        const currentIndex = WORKFLOW_ORDER.indexOf(state.currentStage);
        if (currentIndex < WORKFLOW_ORDER.length - 1) {
          nextStage = WORKFLOW_ORDER[currentIndex + 1];
        }
        return state;
      });
      return nextStage;
    },

    getPreviousStage: () => {
      let prevStage: WorkflowStage | null = null;
      update(state => {
        const currentIndex = WORKFLOW_ORDER.indexOf(state.currentStage);
        if (currentIndex > 0) {
          prevStage = WORKFLOW_ORDER[currentIndex - 1];
        }
        return state;
      });
      return prevStage;
    },

    reset: () => {
      set({
        currentStage: 'import',
        completedStages: new Set(),
        canAdvanceTo: (stage: WorkflowStage) => {
          const currentIndex = WORKFLOW_ORDER.indexOf(stage);
          return currentIndex <= 0; // Only import stage accessible initially
        }
      });
    }
  };
}

export const workflowStore = createWorkflowStore();

// Helper function to get stage display names
export function getStageDisplayName(stage: WorkflowStage): string {
  switch (stage) {
    case 'import': return 'Import';
    case 'edit': return 'Edit';
    case 'prepare': return 'Prepare';
    case 'program': return 'Program';
    case 'simulate': return 'Simulate';
    case 'export': return 'Export';
    default: return stage;
  }
}

// Helper function to get stage descriptions
export function getStageDescription(stage: WorkflowStage): string {
  switch (stage) {
    case 'import': return 'Import DXF or SVG drawings';
    case 'edit': return 'Edit drawing using basic tools';
    case 'prepare': return 'Analyze chains and detect parts';
    case 'program': return 'Build tool paths with cut parameters';
    case 'simulate': return 'Simulate cutting process';
    case 'export': return 'Generate and download G-code';
    default: return '';
  }
}