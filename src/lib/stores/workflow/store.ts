/**
 * Workflow state management for MetalHead CAM application
 * Manages the 6-stage workflow: Import → Edit → Prepare → Program → Simulate → Export
 */

import { writable } from 'svelte/store';
import { WorkflowStage } from './enums';
import type { WorkflowState, WorkflowStore } from './interfaces';
import { validateStageAdvancement, WORKFLOW_ORDER } from './functions';

function createWorkflowStore(): WorkflowStore {
    const initialState: WorkflowState = {
        currentStage: WorkflowStage.IMPORT,
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
                currentStage: WorkflowStage.IMPORT,
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
