import type { WorkflowStage } from './enums';

export interface WorkflowState {
    currentStage: WorkflowStage;
    completedStages: Set<WorkflowStage>;
    canAdvanceTo: (stage: WorkflowStage) => boolean;
}
