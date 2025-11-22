/**
 * Drawing Store Helper Functions
 *
 * Helper functions that work with drawing data but don't directly modify the store.
 */

import { WorkflowStage } from '$lib/stores/workflow/enums';
import { partStore } from '$lib/stores/parts/store';
import { overlayStore } from '$lib/stores/overlay/store';
import { tessellationStore } from '$lib/stores/tessellation/store';
import { cutStore } from '$lib/stores/cuts/store';
import { operationsStore } from '$lib/stores/operations/store';
import { rapidStore } from '$lib/stores/rapids/store';
import { workflowStore } from '$lib/stores/workflow/store';
import { planStore } from '$lib/stores/plan/store';

// Import workflow store for state management
interface WorkflowStore {
    invalidateDownstreamStages: (
        fromStage: 'edit' | WorkflowStage.PREPARE
    ) => void;
}

/**
 * Helper function to reset downstream stages when drawing is modified
 */
export const resetDownstreamStages = (
    fromStage: 'edit' | WorkflowStage.PREPARE = 'edit'
): void => {
    // Clear stage-specific data
    // Chains are auto-generated from drawing layers, no need to clear them
    partStore.clearParts();

    // Clear other stores
    overlayStore.clearStageOverlay(WorkflowStage.PREPARE);
    overlayStore.clearStageOverlay(WorkflowStage.PROGRAM);
    overlayStore.clearStageOverlay(WorkflowStage.SIMULATE);
    overlayStore.clearStageOverlay(WorkflowStage.EXPORT);
    tessellationStore.clearTessellation();

    // Clear program-specific stores
    cutStore.reset();
    operationsStore.reset();
    rapidStore.reset();
    planStore.reset();

    // Reset workflow completion status for downstream stages
    (workflowStore as WorkflowStore).invalidateDownstreamStages(fromStage);
};
