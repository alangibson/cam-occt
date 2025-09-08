/**
 * Workflow state management for MetalHead CAM application
 * Manages the 6-stage workflow: Import → Edit → Prepare → Program → Simulate → Export
 */

import { writable, type Writable } from 'svelte/store';

export type WorkflowStage =
    | 'import'
    | 'edit'
    | 'prepare'
    | 'program'
    | 'simulate'
    | 'export';

export interface WorkflowState {
    currentStage: WorkflowStage;
    completedStages: Set<WorkflowStage>;
    canAdvanceTo: (stage: WorkflowStage) => boolean;
}

// Define the workflow progression order
const WORKFLOW_ORDER: WorkflowStage[] = [
    'import',
    'edit',
    'prepare',
    'program',
    'simulate',
    'export',
];

/**
 * Validates if a stage can be advanced to based on completed stages
 * @param targetStage Stage to check advancement to
 * @param completedStages Set of already completed stages
 * @returns Whether the target stage can be advanced to
 */
function validateStageAdvancement(
    targetStage: WorkflowStage,
    completedStages: Set<WorkflowStage>
): boolean {
    const targetIndex = WORKFLOW_ORDER.indexOf(targetStage);

    // Special case: Export stage becomes available when Program is completed (same as Simulate)
    if (targetStage === 'export') {
        // Export requires program to be completed, but not simulate
        return (
            completedStages.has('import') &&
            completedStages.has('edit') &&
            completedStages.has('prepare') &&
            completedStages.has('program')
        );
    }

    // For sequential workflow, all previous stages must be completed
    for (let i: number = 0; i < targetIndex; i++) {
        if (!completedStages.has(WORKFLOW_ORDER[i])) {
            return false;
        }
    }
    return true;
}

function createWorkflowStore(): Writable<WorkflowState> & {
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
} {
    const initialState: WorkflowState = {
        currentStage: 'import',
        completedStages: new Set(),
        canAdvanceTo: (stage: WorkflowStage) =>
            validateStageAdvancement(stage, initialState.completedStages),
    };

    const { subscribe, set, update } = writable<WorkflowState>(initialState);

    return {
        subscribe,
        set,
        update,

        setStage: (stage: WorkflowStage) => {
            update((state) => {
                if (state.canAdvanceTo(stage)) {
                    return { ...state, currentStage: stage };
                }
                return state;
            });
        },

        completeStage: (stage: WorkflowStage) => {
            update((state) => {
                const newCompleted: Set<WorkflowStage> = new Set(
                    state.completedStages
                );
                newCompleted.add(stage);

                return {
                    ...state,
                    completedStages: newCompleted,
                    canAdvanceTo: (targetStage: WorkflowStage) =>
                        validateStageAdvancement(targetStage, newCompleted),
                };
            });
        },

        canAdvanceTo: (stage: WorkflowStage) => {
            let canAdvance: boolean = false;
            update((state) => {
                canAdvance = state.canAdvanceTo(stage);
                return state;
            });
            return canAdvance;
        },

        getNextStage: () => {
            let nextStage: WorkflowStage | null = null;
            update((state) => {
                const currentIndex: number = WORKFLOW_ORDER.indexOf(
                    state.currentStage
                );
                if (currentIndex < WORKFLOW_ORDER.length - 1) {
                    nextStage = WORKFLOW_ORDER[currentIndex + 1];
                }
                return state;
            });
            return nextStage;
        },

        getPreviousStage: () => {
            let prevStage: WorkflowStage | null = null;
            update((state) => {
                const currentIndex: number = WORKFLOW_ORDER.indexOf(
                    state.currentStage
                );
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
                    const targetIndex: number = WORKFLOW_ORDER.indexOf(stage);
                    // Only import stage (index 0) accessible initially
                    return targetIndex === 0;
                },
            });
        },

        resetFromStage: (stage: WorkflowStage) => {
            update((state) => {
                const stageIndex: number = WORKFLOW_ORDER.indexOf(stage);
                const newCompleted: Set<WorkflowStage> =
                    new Set<WorkflowStage>();

                // Keep only completed stages before the reset stage
                for (const completedStage of state.completedStages) {
                    const completedIndex: number =
                        WORKFLOW_ORDER.indexOf(completedStage);
                    if (completedIndex < stageIndex) {
                        newCompleted.add(completedStage);
                    }
                }

                // If current stage is after reset stage, move back to reset stage
                const currentIndex: number = WORKFLOW_ORDER.indexOf(
                    state.currentStage
                );
                const newCurrentStage: WorkflowStage =
                    currentIndex > stageIndex ? stage : state.currentStage;

                return {
                    ...state,
                    currentStage: newCurrentStage,
                    completedStages: newCompleted,
                    canAdvanceTo: (targetStage: WorkflowStage) =>
                        validateStageAdvancement(targetStage, newCompleted),
                };
            });
        },

        invalidateDownstreamStages: (fromStage: WorkflowStage) => {
            update((state) => {
                const fromIndex: number = WORKFLOW_ORDER.indexOf(fromStage);
                const newCompleted: Set<WorkflowStage> =
                    new Set<WorkflowStage>();

                // Keep only completed stages up to and including the fromStage
                for (const completedStage of state.completedStages) {
                    const completedIndex: number =
                        WORKFLOW_ORDER.indexOf(completedStage);
                    if (completedIndex <= fromIndex) {
                        newCompleted.add(completedStage);
                    }
                }

                return {
                    ...state,
                    completedStages: newCompleted,
                    canAdvanceTo: (targetStage: WorkflowStage) =>
                        validateStageAdvancement(targetStage, newCompleted),
                };
            });
        },

        // Restore workflow state from persistence (bypasses validation)
        restore: (
            currentStage: WorkflowStage,
            completedStages: WorkflowStage[]
        ) => {
            const completedSet: Set<WorkflowStage> = new Set(completedStages);
            set({
                currentStage,
                completedStages: completedSet,
                canAdvanceTo: (targetStage: WorkflowStage) =>
                    validateStageAdvancement(targetStage, completedSet),
            });
        },
    };
}

export const workflowStore: ReturnType<typeof createWorkflowStore> =
    createWorkflowStore();

// Helper function to get stage display names
export function getStageDisplayName(stage: WorkflowStage): string {
    switch (stage) {
        case 'import':
            return 'Import';
        case 'edit':
            return 'Edit';
        case 'prepare':
            return 'Prepare';
        case 'program':
            return 'Program';
        case 'simulate':
            return 'Simulate';
        case 'export':
            return 'Export';
        default:
            return stage;
    }
}

// Helper function to get stage descriptions
export function getStageDescription(stage: WorkflowStage): string {
    switch (stage) {
        case 'import':
            return 'Import DXF or SVG drawings';
        case 'edit':
            return 'Edit drawing using basic tools';
        case 'prepare':
            return 'Analyze chains and detect parts';
        case 'program':
            return 'Build tool paths with cut parameters';
        case 'simulate':
            return 'Simulate cutting process';
        case 'export':
            return 'Generate and download G-code';
        default:
            return '';
    }
}
