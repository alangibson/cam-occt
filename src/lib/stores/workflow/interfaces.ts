import type { Writable } from 'svelte/store';
import type { WorkflowStage } from './enums';

export interface WorkflowState {
    currentStage: WorkflowStage;
    completedStages: Set<WorkflowStage>;
    canAdvanceTo: (stage: WorkflowStage) => boolean;
}

export interface WorkflowStore extends Writable<WorkflowState> {
    setStage: (stage: WorkflowStage) => void;
    completeStage: (stage: WorkflowStage) => void;
    canAdvanceTo: (stage: WorkflowStage) => boolean;
    getNextStage: () => WorkflowStage | null;
    getPreviousStage: () => WorkflowStage | null;
    reset: () => void;
    resetFromStage: (stage: WorkflowStage) => void;
    invalidateDownstreamStages: (fromStage: WorkflowStage) => void;
    restore: (
        currentStage: WorkflowStage,
        completedStages: WorkflowStage[]
    ) => void;
}
